using CheckFillingAPI.Models;
using CheckFillingAPI.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace CheckFillingAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var (success, token, user) = await _authService.LoginAsync(request.Email, request.Password);

        if (!success)
        {
            return Unauthorized(new { message = "Email ou mot de passe incorrect" });
        }

        // Déposer le JWT en cookie HttpOnly pour que le front puisse l'envoyer automatiquement
        Response.Cookies.Append("jwt", token!, new CookieOptions
        {
            HttpOnly = true,
            SameSite = SameSiteMode.Lax, // Lax fonctionne en HTTP sans Secure
            Secure = false, // false pour HTTP, true seulement avec HTTPS
            Expires = DateTimeOffset.UtcNow.AddMinutes(240)
        });

        return Ok(new
        {
            success = true,
            token,
            user = new
            {
                id = user!.Id,
                email = user.Email,
                firstName = user.FirstName,
                lastName = user.LastName,
                direction = user.Direction,
                phoneNumber = user.PhoneNumber,
                role = user.Role,
                region = user.Region,
                createdAt = user.CreatedAt
            }
        });
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        var (success, user) = await _authService.RegisterAsync(request.Email, request.Password);

        if (!success)
        {
            return BadRequest(new { message = "Cet email est déjà utilisé" });
        }

        var token = _authService.GenerateJwtToken(user!);

        Response.Cookies.Append("jwt", token, new CookieOptions
        {
            HttpOnly = true,
            SameSite = SameSiteMode.Lax, // Lax fonctionne en HTTP sans Secure
            Secure = false, // false pour HTTP, true seulement avec HTTPS
            Expires = DateTimeOffset.UtcNow.AddMinutes(240)
        });

        return Ok(new
        {
            success = true,
            token,
            user = new
            {
                id = user!.Id,
                email = user.Email,
                createdAt = user.CreatedAt
            }
        });
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> Me()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        var user = await _authService.GetUserByIdAsync(int.Parse(userId));
        if (user == null)
        {
            return Unauthorized();
        }

        return Ok(new
        {
            user = new
            {
                id = user.Id,
                email = user.Email,
                firstName = user.FirstName,
                lastName = user.LastName,
                direction = user.Direction,
                phoneNumber = user.PhoneNumber,
                role = user.Role,
                region = user.Region,
                createdAt = user.CreatedAt
            }
        });
    }

    [HttpPost("logout")]
    public IActionResult Logout()
    {
        Response.Cookies.Delete("jwt");
        return Ok(new { success = true });
    }

    [Authorize]
    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId))
        {
            return Unauthorized();
        }

        var user = await _authService.GetUserByIdAsync(int.Parse(userId));
        if (user == null)
        {
            return Unauthorized();
        }

        // Vérifier le mot de passe actuel
        if (!BCrypt.Net.BCrypt.Verify(request.CurrentPassword, user.PasswordHash))
        {
            return BadRequest(new { message = "Mot de passe actuel incorrect" });
        }

        // Mettre à jour le mot de passe
        var success = await _authService.ChangePasswordAsync(int.Parse(userId), request.NewPassword);
        if (!success)
        {
            return BadRequest(new { message = "Échec de la modification du mot de passe" });
        }

        return Ok(new { success = true, message = "Mot de passe modifié avec succès" });
    }
}

public record LoginRequest(string Email, string Password);
public record RegisterRequest(string Email, string Password);
public record ChangePasswordRequest(string CurrentPassword, string NewPassword);

