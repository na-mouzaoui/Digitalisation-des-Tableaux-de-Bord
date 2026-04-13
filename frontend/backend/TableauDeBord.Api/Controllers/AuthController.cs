using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TableauDeBord.Api.Models.Auth;
using TableauDeBord.Api.Services;

namespace TableauDeBord.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController : ControllerBase
{
    private readonly IUserAuthService _userAuthService;

    public AuthController(IUserAuthService userAuthService)
    {
        _userAuthService = userAuthService;
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login([FromBody] LoginRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { message = "Email/login et mot de passe requis." });
        }

        var response = await _userAuthService.LoginAsync(request.Email.Trim(), request.Password, cancellationToken);
        if (response is null)
        {
            return Unauthorized(new { message = "Identifiants invalides." });
        }

        return Ok(response);
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> Me(CancellationToken cancellationToken)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue(ClaimTypes.Name)
            ?? User.FindFirstValue(ClaimTypes.Email);

        if (string.IsNullOrWhiteSpace(userId))
        {
            return Unauthorized(new { message = "Token invalide." });
        }

        var user = await _userAuthService.GetCurrentUserAsync(userId, cancellationToken);
        if (user is null)
        {
            return NotFound(new { message = "Utilisateur introuvable." });
        }

        return Ok(new { user });
    }

    [HttpPost("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request, CancellationToken cancellationToken)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(userId))
        {
            return Unauthorized(new { message = "Token invalide." });
        }

        if (string.IsNullOrWhiteSpace(request.CurrentPassword) || string.IsNullOrWhiteSpace(request.NewPassword))
        {
            return BadRequest(new { message = "Mot de passe actuel et nouveau mot de passe requis." });
        }

        if (request.NewPassword.Length < 6)
        {
            return BadRequest(new { message = "Le nouveau mot de passe doit contenir au moins 6 caracteres." });
        }

        var changed = await _userAuthService.ChangePasswordAsync(userId, request.CurrentPassword, request.NewPassword, cancellationToken);
        if (!changed)
        {
            return BadRequest(new { message = "Impossible de changer le mot de passe." });
        }

        return Ok(new { message = "Mot de passe modifie avec succes." });
    }
}
