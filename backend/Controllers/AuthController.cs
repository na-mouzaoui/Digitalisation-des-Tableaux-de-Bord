using DigitalisationDesTableauxDeBordAPI.Data;
using DigitalisationDesTableauxDeBordAPI.Models;
using DigitalisationDesTableauxDeBordAPI.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace DigitalisationDesTableauxDeBordAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly AppDbContext _context;

    public AuthController(IAuthService authService, AppDbContext context)
    {
        _authService = authService;
        _context = context;
    }

    private async Task<(List<int> DomaineIds, List<int> SousDomaineIds)> DeriveFromKpis(List<int> kpiIds)
    {
        if (kpiIds.Count == 0) return (new List<int>(), new List<int>());

        var sousDomaineIds = await _context.Kpis
            .Where(k => kpiIds.Contains(k.Id))
            .Select(k => k.SousDomaineId)
            .Distinct()
            .ToListAsync();

        var domaineIds = await _context.SousDomaines
            .Where(sd => sousDomaineIds.Contains(sd.Id))
            .Select(sd => sd.DomaineId)
            .Distinct()
            .ToListAsync();

        return (domaineIds, sousDomaineIds);
    }

    private static List<int> ParseCommaSeparatedIds(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return new List<int>();
        return raw
            .Split(',', StringSplitOptions.RemoveEmptyEntries)
            .Select(s => { int.TryParse(s.Trim(), out var id); return id; })
            .Where(id => id > 0)
            .Distinct()
            .ToList();
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var (success, token, user, mustChangePassword) = await _authService.LoginAsync(request.Email, request.Password);

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

        var kpiIds = ParseCommaSeparatedIds(user!.AllowedKpis);
        var (domaineIds, sousDomaineIds) = await DeriveFromKpis(kpiIds);

        return Ok(new
        {
            success = true,
            token,
            mustChangePassword,
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
                allowedKpis = kpiIds,
                allowedDomaines = domaineIds,
                allowedSousDomaines = sousDomaineIds,
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
            return BadRequest(new { message = "Cet email est déjé utilisé" });
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

        var kpiIds = ParseCommaSeparatedIds(user.AllowedKpis);
        var (domaineIds, sousDomaineIds) = await DeriveFromKpis(kpiIds);

        return Ok(new
        {
            mustChangePassword = user.MustChangePassword,
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
                allowedKpis = kpiIds,
                allowedDomaines = domaineIds,
                allowedSousDomaines = sousDomaineIds,
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

        // Vérifier le mot de passe actuel (sauf si changement forcé)
        if (!user.MustChangePassword && !BCrypt.Net.BCrypt.Verify(request.CurrentPassword, user.PasswordHash))
        {
            return BadRequest(new { message = "Mot de passe actuel incorrect" });
        }

        // Mettre é jour le mot de passe
        var success = await _authService.ChangePasswordAsync(int.Parse(userId), request.NewPassword);
        if (!success)
        {
            return BadRequest(new { message = "échec de la modification du mot de passe" });
        }

        return Ok(new { success = true, message = "Mot de passe modifié avec succés" });
    }
}

public record LoginRequest(string Email, string Password);
public record RegisterRequest(string Email, string Password);
public record ChangePasswordRequest(string CurrentPassword, string NewPassword);

