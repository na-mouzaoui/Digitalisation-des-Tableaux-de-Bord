using System.Globalization;
using System.Text.Json;
using DigitalisationDesTableauxDeBordAPI.Controllers;
using DigitalisationDesTableauxDeBordAPI.Data;
using Microsoft.EntityFrameworkCore;

namespace DigitalisationDesTableauxDeBordAPI.Services;

public class NormalizedTableauPersistenceService : INormalizedTableauPersistenceService
{
    private readonly AppDbContext _context;

    public NormalizedTableauPersistenceService(AppDbContext context)
    {
        _context = context;
    }

    public async Task PersistAsync(TableauRequest request, string resolvedDirection, CancellationToken cancellationToken = default)
    {
        var periodId = await EnsurePeriodAsync(request.Mois, request.Annee, cancellationToken);
        using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(request.DataJson) ? "{}" : request.DataJson);
        var root = doc.RootElement;
        var tabKey = (request.TabKey ?? string.Empty).Trim().ToLowerInvariant();

        switch (tabKey)
        {
            case "reclamation":
                await SaveReclamationAsync(periodId, root, cancellationToken);
                break;
            case "reclamation_gp":
                await SaveReclamationGpAsync(periodId, root, cancellationToken);
                break;
            case "e_payement_pop":
                await SaveEPayementAsync(periodId, "Epaymentpop", root, cancellationToken);
                break;
            case "e_payement_prp":
                await SaveEPayementAsync(periodId, "Epaymentprp", root, cancellationToken);
                break;
            case "total_encaissement":
                await SaveEncaissementAsync(periodId, root, cancellationToken);
                break;
            case "recouvrement":
                await SaveRecouvrementAsync(periodId, root, cancellationToken);
                break;
            case "chiffre_affaires_mda":
                await SaveCaAsync(periodId, root, cancellationToken);
                break;
            case "parc_abonnes_b2b":
                await SaveParcAbonnesAsync(periodId, "ParcAbonnesB2B", root, cancellationToken);
                break;
            case "parc_abonnes_gp":
                await SaveParcAbonnesAsync(periodId, "ParcAbonnesGP", root, cancellationToken);
                break;
            case "total_parc_abonnes":
                await SaveParcAbonnesAsync(periodId, "ParcAbonnes", root, cancellationToken);
                break;
            case "total_parc_abonnes_technologie":
                await SaveParcAbonnesAsync(periodId, "ParcAbonnesTechnologie", root, cancellationToken);
                break;
            case "activation":
                await SaveDesActivationAsync(periodId, "Activation", root, cancellationToken);
                break;
            case "desactivation_resiliation":
                await SaveDesActivationAsync(periodId, "Desactivation", root, cancellationToken);
                break;
            case "realisation_technique_reseau":
                await SaveRealisationAsync(periodId, root, cancellationToken);
                break;
            case "situation_reseau":
                await SaveSituationAsync(periodId, root, cancellationToken);
                break;
            case "trafic_data":
                await SaveTdAsync(periodId, root, cancellationToken);
                break;
            case "amelioration_qualite":
                await SaveAmeliorationQualiteAsync(periodId, resolvedDirection, root, cancellationToken);
                break;
            case "couverture_reseau":
                await SaveCouvertureReseauAsync(periodId, root, cancellationToken);
                break;
            case "action_notable_reseau":
                await SaveAnAsync(periodId, root, cancellationToken);
                break;
            case "disponibilite_reseau":
                await SaveDispoReseauAsync(periodId, root, cancellationToken);
                break;
            case "mttr":
                await SaveMttrAsync(periodId, root, cancellationToken);
                break;
            case "frais_personnel":
                await SaveFraisPersonnelAsync(periodId, root, cancellationToken);
                break;
            case "effectif_gsp":
                await SaveEffectifGspAsync(periodId, root, cancellationToken);
                break;
            case "absenteisme":
                await SaveAbsenteismeAsync(periodId, root, cancellationToken);
                break;
            case "mouvement_effectifs":
                await SaveMouvEffectifsAsync(periodId, root, cancellationToken);
                break;
            case "effectifs_formes_gsp":
                await SaveFormationGspAsync(periodId, root, cancellationToken);
                break;
            case "formations_domaines":
                await SaveFormationDomAsync(periodId, root, cancellationToken);
                break;
            default:
                break;
        }
    }

    private async Task<int> EnsurePeriodAsync(string mois, string annee, CancellationToken ct)
    {
        var m = ParseInt(mois);
        var y = ParseInt(annee);

        await _context.Database.ExecuteSqlInterpolatedAsync($@"
IF NOT EXISTS (SELECT 1 FROM [dbo].[Periode] WHERE [Mois] = {m} AND [Annee] = {y})
    INSERT INTO [dbo].[Periode]([Mois],[Annee]) VALUES ({m},{y});", ct);

        return await _context.Database.SqlQuery<int>($"SELECT TOP 1 [Id] AS [Value] FROM [dbo].[Periode] WHERE [Mois] = {m} AND [Annee] = {y}").FirstAsync(ct);
    }

    private static int ParseInt(string? value)
    {
        return int.TryParse((value ?? string.Empty).Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var v) ? v : 0;
    }

    private static decimal? ParseDecimal(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var normalized = value.Trim().Replace(" ", string.Empty).Replace(',', '.');
        return decimal.TryParse(normalized, NumberStyles.Any, CultureInfo.InvariantCulture, out var v) ? v : null;
    }

    private static string GetString(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var p)) return string.Empty;
        return p.ValueKind == JsonValueKind.String ? (p.GetString() ?? string.Empty) : p.ToString();
    }

    private static JsonElement[] GetRows(JsonElement root, string property)
    {
        if (!root.TryGetProperty(property, out var rows) || rows.ValueKind != JsonValueKind.Array)
            return Array.Empty<JsonElement>();
        return rows.EnumerateArray().ToArray();
    }

    private async Task<int> EnsureLineAsync(string lineTable, string designation, CancellationToken ct)
    {
        var safeDesignation = designation.Trim();
        if (string.IsNullOrWhiteSpace(safeDesignation)) safeDesignation = "N/A";

        var insertSql = lineTable switch
        {
            "Reclamation_Lignes" => $"IF NOT EXISTS (SELECT 1 FROM [dbo].[Reclamation_Lignes] WHERE [Designation]=N'{safeDesignation.Replace("'", "''")}') INSERT INTO [dbo].[Reclamation_Lignes]([Designation]) VALUES (N'{safeDesignation.Replace("'", "''")}');",
            "ReclamationGP_Lignes" => $"IF NOT EXISTS (SELECT 1 FROM [dbo].[ReclamationGP_Lignes] WHERE [Designation]=N'{safeDesignation.Replace("'", "''")}') INSERT INTO [dbo].[ReclamationGP_Lignes]([Designation]) VALUES (N'{safeDesignation.Replace("'", "''")}');",
            "Epayement_Lignes" => $"IF NOT EXISTS (SELECT 1 FROM [dbo].[Epayement_Lignes] WHERE [Designation]=N'{safeDesignation.Replace("'", "''")}') INSERT INTO [dbo].[Epayement_Lignes]([Designation]) VALUES (N'{safeDesignation.Replace("'", "''")}');",
            "Encaissement_Lignes" => $"IF NOT EXISTS (SELECT 1 FROM [dbo].[Encaissement_Lignes] WHERE [Designation]=N'{safeDesignation.Replace("'", "''")}') INSERT INTO [dbo].[Encaissement_Lignes]([Designation]) VALUES (N'{safeDesignation.Replace("'", "''")}');",
            "Recouvrement_Lignes" => $"IF NOT EXISTS (SELECT 1 FROM [dbo].[Recouvrement_Lignes] WHERE [Designation]=N'{safeDesignation.Replace("'", "''")}') INSERT INTO [dbo].[Recouvrement_Lignes]([Designation]) VALUES (N'{safeDesignation.Replace("'", "''")}');",
            "CA_Lignes" => $"IF NOT EXISTS (SELECT 1 FROM [dbo].[CA_Lignes] WHERE [Designation]=N'{safeDesignation.Replace("'", "''")}') INSERT INTO [dbo].[CA_Lignes]([Designation]) VALUES (N'{safeDesignation.Replace("'", "''")}');",
            "ParcAbonnes_Lignes" => $"IF NOT EXISTS (SELECT 1 FROM [dbo].[ParcAbonnes_Lignes] WHERE [Designation]=N'{safeDesignation.Replace("'", "''")}') INSERT INTO [dbo].[ParcAbonnes_Lignes]([Designation]) VALUES (N'{safeDesignation.Replace("'", "''")}');",
            "Des_Activation_Lignes" => $"IF NOT EXISTS (SELECT 1 FROM [dbo].[Des_Activation_Lignes] WHERE [Designation]=N'{safeDesignation.Replace("'", "''")}') INSERT INTO [dbo].[Des_Activation_Lignes]([Designation]) VALUES (N'{safeDesignation.Replace("'", "''")}');",
            "Realisation_Lignes" => $"IF NOT EXISTS (SELECT 1 FROM [dbo].[Realisation_Lignes] WHERE [Designation]=N'{safeDesignation.Replace("'", "''")}') INSERT INTO [dbo].[Realisation_Lignes]([Designation]) VALUES (N'{safeDesignation.Replace("'", "''")}');",
            "Situation_Lignes" => $"IF NOT EXISTS (SELECT 1 FROM [dbo].[Situation_Lignes] WHERE [Designation]=N'{safeDesignation.Replace("'", "''")}') INSERT INTO [dbo].[Situation_Lignes]([Designation]) VALUES (N'{safeDesignation.Replace("'", "''")}');",
            "TD_Lignes" => $"IF NOT EXISTS (SELECT 1 FROM [dbo].[TD_Lignes] WHERE [Designation]=N'{safeDesignation.Replace("'", "''")}') INSERT INTO [dbo].[TD_Lignes]([Designation]) VALUES (N'{safeDesignation.Replace("'", "''")}');",
            "AN_Lignes" => $"IF NOT EXISTS (SELECT 1 FROM [dbo].[AN_Lignes] WHERE [Designation]=N'{safeDesignation.Replace("'", "''")}') INSERT INTO [dbo].[AN_Lignes]([Designation]) VALUES (N'{safeDesignation.Replace("'", "''")}');",
            "DispoReseau_Lignes" => $"IF NOT EXISTS (SELECT 1 FROM [dbo].[DispoReseau_Lignes] WHERE [Designation]=N'{safeDesignation.Replace("'", "''")}') INSERT INTO [dbo].[DispoReseau_Lignes]([Designation]) VALUES (N'{safeDesignation.Replace("'", "''")}');",
            "Creances_Lignes" => $"IF NOT EXISTS (SELECT 1 FROM [dbo].[Creances_Lignes] WHERE [Designation]=N'{safeDesignation.Replace("'", "''")}') INSERT INTO [dbo].[Creances_Lignes]([Designation]) VALUES (N'{safeDesignation.Replace("'", "''")}');",
            "FraisPersonnel_Lignes" => $"IF NOT EXISTS (SELECT 1 FROM [dbo].[FraisPersonnel_Lignes] WHERE [Designation]=N'{safeDesignation.Replace("'", "''")}') INSERT INTO [dbo].[FraisPersonnel_Lignes]([Designation]) VALUES (N'{safeDesignation.Replace("'", "''")}');",
            "EffectifGSP_Lignes" => $"IF NOT EXISTS (SELECT 1 FROM [dbo].[EffectifGSP_Lignes] WHERE [Designation]=N'{safeDesignation.Replace("'", "''")}') INSERT INTO [dbo].[EffectifGSP_Lignes]([Designation]) VALUES (N'{safeDesignation.Replace("'", "''")}');",
            "Absenteisme_Lignes" => $"IF NOT EXISTS (SELECT 1 FROM [dbo].[Absenteisme_Lignes] WHERE [Designation]=N'{safeDesignation.Replace("'", "''")}') INSERT INTO [dbo].[Absenteisme_Lignes]([Designation]) VALUES (N'{safeDesignation.Replace("'", "''")}');",
            "MouvEffectifs_Lignes" => $"IF NOT EXISTS (SELECT 1 FROM [dbo].[MouvEffectifs_Lignes] WHERE [Designation]=N'{safeDesignation.Replace("'", "''")}') INSERT INTO [dbo].[MouvEffectifs_Lignes]([Designation]) VALUES (N'{safeDesignation.Replace("'", "''")}');",
            "FormationGSP_Lignes" => $"IF NOT EXISTS (SELECT 1 FROM [dbo].[FormationGSP_Lignes] WHERE [Designation]=N'{safeDesignation.Replace("'", "''")}') INSERT INTO [dbo].[FormationGSP_Lignes]([Designation]) VALUES (N'{safeDesignation.Replace("'", "''")}');",
            "FormationDom_Lignes" => $"IF NOT EXISTS (SELECT 1 FROM [dbo].[FormationDom_Lignes] WHERE [Designation]=N'{safeDesignation.Replace("'", "''")}') INSERT INTO [dbo].[FormationDom_Lignes]([Designation]) VALUES (N'{safeDesignation.Replace("'", "''")}');",
            "CompteResultat_Lignes" => $"IF NOT EXISTS (SELECT 1 FROM [dbo].[CompteResultat_Lignes] WHERE [Designation]=N'{safeDesignation.Replace("'", "''")}') INSERT INTO [dbo].[CompteResultat_Lignes]([Designation]) VALUES (N'{safeDesignation.Replace("'", "''")}');",
            _ => string.Empty,
        };

        if (string.IsNullOrEmpty(insertSql)) return 0;
        await _context.Database.ExecuteSqlRawAsync(insertSql, ct);

        var selectSql = lineTable switch
        {
            "Reclamation_Lignes" => $"SELECT TOP 1 [Id] AS [Value] FROM [dbo].[Reclamation_Lignes] WHERE [Designation]=N'{safeDesignation.Replace("'", "''")}'",
            "ReclamationGP_Lignes" => $"SELECT TOP 1 [Id] AS [Value] FROM [dbo].[ReclamationGP_Lignes] WHERE [Designation]=N'{safeDesignation.Replace("'", "''")}'",
            "Epayement_Lignes" => $"SELECT TOP 1 [Id] AS [Value] FROM [dbo].[Epayement_Lignes] WHERE [Designation]=N'{safeDesignation.Replace("'", "''")}'",
            "Encaissement_Lignes" => $"SELECT TOP 1 [Id] AS [Value] FROM [dbo].[Encaissement_Lignes] WHERE [Designation]=N'{safeDesignation.Replace("'", "''")}'",
            "Recouvrement_Lignes" => $"SELECT TOP 1 [Id] AS [Value] FROM [dbo].[Recouvrement_Lignes] WHERE [Designation]=N'{safeDesignation.Replace("'", "''")}'",
            "CA_Lignes" => $"SELECT TOP 1 [Id] AS [Value] FROM [dbo].[CA_Lignes] WHERE [Designation]=N'{safeDesignation.Replace("'", "''")}'",
            "ParcAbonnes_Lignes" => $"SELECT TOP 1 [Id] AS [Value] FROM [dbo].[ParcAbonnes_Lignes] WHERE [Designation]=N'{safeDesignation.Replace("'", "''")}'",
            "Des_Activation_Lignes" => $"SELECT TOP 1 [Id] AS [Value] FROM [dbo].[Des_Activation_Lignes] WHERE [Designation]=N'{safeDesignation.Replace("'", "''")}'",
            "Realisation_Lignes" => $"SELECT TOP 1 [Id] AS [Value] FROM [dbo].[Realisation_Lignes] WHERE [Designation]=N'{safeDesignation.Replace("'", "''")}'",
            "Situation_Lignes" => $"SELECT TOP 1 [Id] AS [Value] FROM [dbo].[Situation_Lignes] WHERE [Designation]=N'{safeDesignation.Replace("'", "''")}'",
            "TD_Lignes" => $"SELECT TOP 1 [Id] AS [Value] FROM [dbo].[TD_Lignes] WHERE [Designation]=N'{safeDesignation.Replace("'", "''")}'",
            "AN_Lignes" => $"SELECT TOP 1 [Id] AS [Value] FROM [dbo].[AN_Lignes] WHERE [Designation]=N'{safeDesignation.Replace("'", "''")}'",
            "DispoReseau_Lignes" => $"SELECT TOP 1 [Id] AS [Value] FROM [dbo].[DispoReseau_Lignes] WHERE [Designation]=N'{safeDesignation.Replace("'", "''")}'",
            "Creances_Lignes" => $"SELECT TOP 1 [Id] AS [Value] FROM [dbo].[Creances_Lignes] WHERE [Designation]=N'{safeDesignation.Replace("'", "''")}'",
            "FraisPersonnel_Lignes" => $"SELECT TOP 1 [Id] AS [Value] FROM [dbo].[FraisPersonnel_Lignes] WHERE [Designation]=N'{safeDesignation.Replace("'", "''")}'",
            "EffectifGSP_Lignes" => $"SELECT TOP 1 [Id] AS [Value] FROM [dbo].[EffectifGSP_Lignes] WHERE [Designation]=N'{safeDesignation.Replace("'", "''")}'",
            "Absenteisme_Lignes" => $"SELECT TOP 1 [Id] AS [Value] FROM [dbo].[Absenteisme_Lignes] WHERE [Designation]=N'{safeDesignation.Replace("'", "''")}'",
            "MouvEffectifs_Lignes" => $"SELECT TOP 1 [Id] AS [Value] FROM [dbo].[MouvEffectifs_Lignes] WHERE [Designation]=N'{safeDesignation.Replace("'", "''")}'",
            "FormationGSP_Lignes" => $"SELECT TOP 1 [Id] AS [Value] FROM [dbo].[FormationGSP_Lignes] WHERE [Designation]=N'{safeDesignation.Replace("'", "''")}'",
            "FormationDom_Lignes" => $"SELECT TOP 1 [Id] AS [Value] FROM [dbo].[FormationDom_Lignes] WHERE [Designation]=N'{safeDesignation.Replace("'", "''")}'",
            "CompteResultat_Lignes" => $"SELECT TOP 1 [Id] AS [Value] FROM [dbo].[CompteResultat_Lignes] WHERE [Designation]=N'{safeDesignation.Replace("'", "''")}'",
            _ => "SELECT 0 AS [Value]",
        };

        return await _context.Database.SqlQueryRaw<int>(selectSql).FirstAsync(ct);
    }

    private async Task<int?> TryGetDrIdAsync(string direction, CancellationToken ct)
    {
        var safe = (direction ?? string.Empty).Trim().Replace("'", "''");
        if (string.IsNullOrWhiteSpace(safe)) return null;
        var sql = $"SELECT TOP 1 [id] AS [Value] FROM [dbo].[DR] WHERE LOWER(LTRIM(RTRIM([nom]))) = LOWER(N'{safe}')";
        var values = await _context.Database.SqlQueryRaw<int>(sql).ToListAsync(ct);
        return values.FirstOrDefault();
    }

    private async Task<int?> TryGetWilayaIdAsync(string wilaya, CancellationToken ct)
    {
        var safe = (wilaya ?? string.Empty).Trim().Replace("'", "''");
        if (string.IsNullOrWhiteSpace(safe)) return null;
        var sql = $"SELECT TOP 1 [id] AS [Value] FROM [dbo].[Wilaya] WHERE LOWER(LTRIM(RTRIM([nom]))) = LOWER(N'{safe}')";
        var values = await _context.Database.SqlQueryRaw<int>(sql).ToListAsync(ct);
        return values.FirstOrDefault();
    }

    private async Task SaveReclamationAsync(int periodId, JsonElement root, CancellationToken ct)
    {
        await _context.Database.ExecuteSqlInterpolatedAsync($"DELETE FROM [dbo].[Reclamation] WHERE [Id_Periode] = {periodId}", ct);
        foreach (var row in GetRows(root, "reclamationRows"))
        {
            var category = GetString(row, "category");
            var type = GetString(row, "type");
            var designation = $"{category}-{type}";
            var lineId = await EnsureLineAsync("Reclamation_Lignes", designation, ct);
            var m = type.Equals("B2B", StringComparison.OrdinalIgnoreCase) ? ParseDecimal(GetString(row, "mB2b")) : ParseDecimal(GetString(row, "mGp"));
            var m1 = type.Equals("B2B", StringComparison.OrdinalIgnoreCase) ? ParseDecimal(GetString(row, "m1B2b")) : ParseDecimal(GetString(row, "m1Gp"));
            await _context.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO [dbo].[Reclamation]([Id_Designation_Reclamation],[Id_Periode],[M_1],[M]) VALUES ({lineId},{periodId},{m},{m1})", ct);
        }
    }

    private async Task SaveReclamationGpAsync(int periodId, JsonElement root, CancellationToken ct)
    {
        await _context.Database.ExecuteSqlInterpolatedAsync($"DELETE FROM [dbo].[ReclamationGP] WHERE [Id_Periode] = {periodId}", ct);
        foreach (var row in GetRows(root, "reclamationGpRows"))
        {
            var lineId = await EnsureLineAsync("ReclamationGP_Lignes", GetString(row, "label"), ct);
            var recues = ParseDecimal(GetString(row, "recues"));
            var traitees = ParseDecimal(GetString(row, "traitees"));
            decimal? taux = null;
            if (recues.HasValue && recues.Value != 0 && traitees.HasValue)
                taux = (traitees.Value / recues.Value) * 100m;
            await _context.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO [dbo].[ReclamationGP]([Id_Designation_ReclamationGP],[Id_Periode],[M_Recues],[M_Traitees],[Taux],[Part]) VALUES ({lineId},{periodId},{recues},{traitees},{taux},{(decimal?)null})", ct);
        }
    }

    private async Task SaveEPayementAsync(int periodId, string type, JsonElement root, CancellationToken ct)
    {
        await _context.Database.ExecuteSqlInterpolatedAsync($"DELETE FROM [dbo].[Epayement] WHERE [Id_Periode] = {periodId} AND [Type] = {type}", ct);
        var prop = type == "Epaymentpop" ? "ePayementPopRows" : "ePayementPrpRows";
        foreach (var row in GetRows(root, prop))
        {
            var lineId = await EnsureLineAsync("Epayement_Lignes", GetString(row, "rechargement"), ct);
            await _context.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO [dbo].[Epayement]([Id_Designation_Epayement],[Id_Periode],[Type],[M_1],[M],[Evol]) VALUES ({lineId},{periodId},{type},{ParseDecimal(GetString(row, "m1"))},{ParseDecimal(GetString(row, "m"))},{ParseDecimal(GetString(row, "evol"))})", ct);
        }
    }

    private async Task SaveEncaissementAsync(int periodId, JsonElement root, CancellationToken ct)
    {
        await _context.Database.ExecuteSqlInterpolatedAsync($"DELETE FROM [dbo].[Encaissement] WHERE [Id_Periode] = {periodId}", ct);
        foreach (var row in GetRows(root, "totalEncaissementRows"))
        {
            var lineId = await EnsureLineAsync("Encaissement_Lignes", "Total encaissement", ct);
            await _context.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO [dbo].[Encaissement]([Id_Designation_Encaissement],[Id_Periode],[M_1_GP],[M_1_B2B],[M_GP],[M_B2B],[Evol]) VALUES ({lineId},{periodId},{ParseDecimal(GetString(row, "m1Gp"))},{ParseDecimal(GetString(row, "m1B2b"))},{ParseDecimal(GetString(row, "mGp"))},{ParseDecimal(GetString(row, "mB2b"))},{ParseDecimal(GetString(row, "evol"))})", ct);
        }
    }

    private async Task SaveRecouvrementAsync(int periodId, JsonElement root, CancellationToken ct)
    {
        await _context.Database.ExecuteSqlInterpolatedAsync($"DELETE FROM [dbo].[Recouvrement] WHERE [Id_Periode] = {periodId}", ct);
        foreach (var row in GetRows(root, "recouvrementRows"))
        {
            var lineId = await EnsureLineAsync("Recouvrement_Lignes", GetString(row, "label"), ct);
            await _context.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO [dbo].[Recouvrement]([Id_Designation_Recouvrement],[Id_Periode],[M_1_GP],[M_1_B2B],[M_GP],[M_B2B]) VALUES ({lineId},{periodId},{ParseDecimal(GetString(row, "m1Gp"))},{ParseDecimal(GetString(row, "m1B2b"))},{ParseDecimal(GetString(row, "mGp"))},{ParseDecimal(GetString(row, "mB2b"))})", ct);
        }
    }

    private async Task SaveCaAsync(int periodId, JsonElement root, CancellationToken ct)
    {
        await _context.Database.ExecuteSqlInterpolatedAsync($"DELETE FROM [dbo].[CA] WHERE [Id_Periode] = {periodId}", ct);
        foreach (var row in GetRows(root, "chiffreAffairesMdaRows"))
        {
            var lineId = await EnsureLineAsync("CA_Lignes", GetString(row, "designation"), ct);
            await _context.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO [dbo].[CA]([Id_Designation_CA],[Id_Periode],[M_1_Objectif],[M_1_Realise],[M_1_Taux],[M_Objectif],[M_Realise],[M_Taux]) VALUES ({lineId},{periodId},{ParseDecimal(GetString(row, "m1Objectif"))},{ParseDecimal(GetString(row, "m1Realise"))},{ParseDecimal(GetString(row, "m1Taux"))},{ParseDecimal(GetString(row, "mObjectif"))},{ParseDecimal(GetString(row, "mRealise"))},{ParseDecimal(GetString(row, "mTaux"))})", ct);
        }
    }

    private async Task SaveParcAbonnesAsync(int periodId, string type, JsonElement root, CancellationToken ct)
    {
        await _context.Database.ExecuteSqlInterpolatedAsync($"DELETE FROM [dbo].[ParcAbonnes] WHERE [Id_Periode] = {periodId} AND [Type] = {type}", ct);
        var prop = type switch
        {
            "ParcAbonnesB2B" => "parcAbonnesB2bRows",
            "ParcAbonnesGP" => "parcAbonnesGpRows",
            "ParcAbonnes" => "totalParcAbonnesRows",
            _ => "totalParcAbonnesTechnologieRows",
        };

        foreach (var row in GetRows(root, prop))
        {
            var lineId = await EnsureLineAsync("ParcAbonnes_Lignes", GetString(row, "designation"), ct);
            await _context.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO [dbo].[ParcAbonnes]([Id_Designation_ParcAbonnes],[Id_Periode],[Type],[M_1],[M],[Evol]) VALUES ({lineId},{periodId},{type},{ParseDecimal(GetString(row, "m1"))},{ParseDecimal(GetString(row, "m"))},{ParseDecimal(GetString(row, "evol"))})", ct);
        }
    }

    private async Task SaveDesActivationAsync(int periodId, string type, JsonElement root, CancellationToken ct)
    {
        await _context.Database.ExecuteSqlInterpolatedAsync($"DELETE FROM [dbo].[Des_Activation] WHERE [Id_Periode] = {periodId} AND [Type] = {type}", ct);
        var prop = type == "Activation" ? "activationRows" : "desactivationResiliationRows";
        foreach (var row in GetRows(root, prop))
        {
            var lineId = await EnsureLineAsync("Des_Activation_Lignes", GetString(row, "designation"), ct);
            await _context.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO [dbo].[Des_Activation]([Id_Designation_Des_Activation],[Id_Periode],[Type],[M_1],[M],[Evol]) VALUES ({lineId},{periodId},{type},{ParseDecimal(GetString(row, "m1"))},{ParseDecimal(GetString(row, "m"))},{ParseDecimal(GetString(row, "evol"))})", ct);
        }
    }

    private async Task SaveRealisationAsync(int periodId, JsonElement root, CancellationToken ct)
    {
        await _context.Database.ExecuteSqlInterpolatedAsync($"DELETE FROM [dbo].[Realisation] WHERE [Id_Periode] = {periodId}", ct);
        foreach (var row in GetRows(root, "realisationTechniqueReseauRows"))
        {
            var lineId = await EnsureLineAsync("Realisation_Lignes", GetString(row, "label"), ct);
            await _context.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO [dbo].[Realisation]([Id_Designation_Realisation],[Id_Periode],[M_1],[M]) VALUES ({lineId},{periodId},{ParseDecimal(GetString(row, "m1"))},{ParseDecimal(GetString(row, "m"))})", ct);
        }
    }

    private async Task SaveSituationAsync(int periodId, JsonElement root, CancellationToken ct)
    {
        await _context.Database.ExecuteSqlInterpolatedAsync($"DELETE FROM [dbo].[Situation_Reseaux] WHERE [Id_Periode] = {periodId}", ct);
        foreach (var row in GetRows(root, "situationReseauRows"))
        {
            var designation = $"{GetString(row, "situation")} - {GetString(row, "equipements")}";
            var lineId = await EnsureLineAsync("Situation_Lignes", designation, ct);
            await _context.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO [dbo].[Situation_Reseaux]([Id_Designation_Situation],[Id_Periode],[M_1],[M]) VALUES ({lineId},{periodId},{ParseDecimal(GetString(row, "m1"))},{ParseDecimal(GetString(row, "m"))})", ct);
        }
    }

    private async Task SaveTdAsync(int periodId, JsonElement root, CancellationToken ct)
    {
        await _context.Database.ExecuteSqlInterpolatedAsync($"DELETE FROM [dbo].[TD] WHERE [Id_Periode] = {periodId}", ct);
        foreach (var row in GetRows(root, "traficDataRows"))
        {
            var lineId = await EnsureLineAsync("TD_Lignes", GetString(row, "label"), ct);
            await _context.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO [dbo].[TD]([Id_Designation_TD],[Id_Periode],[M_1],[M]) VALUES ({lineId},{periodId},{ParseDecimal(GetString(row, "m1"))},{ParseDecimal(GetString(row, "m"))})", ct);
        }
    }

    private async Task SaveAmeliorationQualiteAsync(int periodId, string direction, JsonElement root, CancellationToken ct)
    {
        var drId = await TryGetDrIdAsync(direction, ct);
        if (!drId.HasValue || drId.Value <= 0) return;

        await _context.Database.ExecuteSqlInterpolatedAsync($"DELETE FROM [dbo].[Amelioration_Qualite] WHERE [Id_Periode] = {periodId} AND [Id_DR] = {drId.Value}", ct);
        foreach (var row in GetRows(root, "ameliorationQualiteRows"))
        {
            await _context.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO [dbo].[Amelioration_Qualite]([Id_DR],[Id_Periode],[M_1_Objectif],[M_1_Realise],[M_Objectif],[M_Realise],[Ecart]) VALUES ({drId.Value},{periodId},{ParseDecimal(GetString(row, "m1Objectif"))},{ParseDecimal(GetString(row, "m1Realise"))},{ParseDecimal(GetString(row, "mObjectif"))},{ParseDecimal(GetString(row, "mRealise"))},{ParseDecimal(GetString(row, "ecart"))})", ct);
        }
    }

    private async Task SaveCouvertureReseauAsync(int periodId, JsonElement root, CancellationToken ct)
    {
        await _context.Database.ExecuteSqlInterpolatedAsync($"DELETE FROM [dbo].[Couverture_Reseau] WHERE [Id_Periode] = {periodId}", ct);
        foreach (var row in GetRows(root, "couvertureReseauRows"))
        {
            await _context.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO [dbo].[Couverture_Reseau]([Id_Region],[Id_Periode],[M_1_Objectif],[M_1_Realise],[M_Objectif],[M_Realise]) VALUES ({0},{periodId},{ParseDecimal(GetString(row, "m1Objectif"))},{ParseDecimal(GetString(row, "m1Realise"))},{ParseDecimal(GetString(row, "mObjectif"))},{ParseDecimal(GetString(row, "mRealise"))})", ct);
        }
    }

    private async Task SaveAnAsync(int periodId, JsonElement root, CancellationToken ct)
    {
        await _context.Database.ExecuteSqlInterpolatedAsync($"DELETE FROM [dbo].[AN] WHERE [Id_Periode] = {periodId}", ct);
        foreach (var row in GetRows(root, "actionNotableReseauRows"))
        {
            var lineId = await EnsureLineAsync("AN_Lignes", GetString(row, "action"), ct);
            await _context.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO [dbo].[AN]([Id_Designation_AN],[Id_Periode],[M_1_Objectif],[M_1_Realise],[M_1_Taux],[M_Objectif],[M_Realise],[M_Taux]) VALUES ({lineId},{periodId},{ParseDecimal(GetString(row, "m1Objectif"))},{ParseDecimal(GetString(row, "m1Realise"))},{ParseDecimal(GetString(row, "m1Taux"))},{ParseDecimal(GetString(row, "mObjectif"))},{ParseDecimal(GetString(row, "mRealise"))},{ParseDecimal(GetString(row, "mTaux"))})", ct);
        }
    }

    private async Task SaveDispoReseauAsync(int periodId, JsonElement root, CancellationToken ct)
    {
        await _context.Database.ExecuteSqlInterpolatedAsync($"DELETE FROM [dbo].[DispoReseau] WHERE [Id_Periode] = {periodId}", ct);
        foreach (var row in GetRows(root, "disponibiliteReseauRows"))
        {
            var lineId = await EnsureLineAsync("DispoReseau_Lignes", GetString(row, "designation"), ct);
            await _context.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO [dbo].[DispoReseau]([Id_Designation_DispoReseau],[Id_Periode],[M_1_Objectif],[M_1_Realise],[M_1_Taux],[M_Objectif],[M_Realise],[M_Taux]) VALUES ({lineId},{periodId},{ParseDecimal(GetString(row, "m1Objectif"))},{ParseDecimal(GetString(row, "m1Realise"))},{ParseDecimal(GetString(row, "m1Taux"))},{ParseDecimal(GetString(row, "mObjectif"))},{ParseDecimal(GetString(row, "mRealise"))},{ParseDecimal(GetString(row, "mTaux"))})", ct);
        }
    }

    private async Task SaveMttrAsync(int periodId, JsonElement root, CancellationToken ct)
    {
        await _context.Database.ExecuteSqlInterpolatedAsync($"DELETE FROM [dbo].[MTTR] WHERE [Id_Periode] = {periodId}", ct);
        foreach (var region in GetRows(root, "mttrRows"))
        {
            if (!region.TryGetProperty("cities", out var cities) || cities.ValueKind != JsonValueKind.Array)
                continue;

            foreach (var city in cities.EnumerateArray())
            {
                var wilaya = GetString(city, "wilayaM");
                var wilayaId = await TryGetWilayaIdAsync(wilaya, ct);
                if (!wilayaId.HasValue || wilayaId.Value <= 0)
                    continue;

                await _context.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO [dbo].[MTTR]([Id_Wilaya],[Id_Periode],[M_1_Objectif],[M_1_Realise],[M_Objectif],[M_Realise],[Ecart]) VALUES ({wilayaId.Value},{periodId},{ParseDecimal(GetString(city, "objectifM1"))},{ParseDecimal(GetString(city, "realiseM1"))},{ParseDecimal(GetString(city, "objectifM"))},{ParseDecimal(GetString(city, "realiseM"))},{ParseDecimal(GetString(city, "ecart"))})", ct);
            }
        }
    }

    private async Task SaveFraisPersonnelAsync(int periodId, JsonElement root, CancellationToken ct)
    {
        await _context.Database.ExecuteSqlInterpolatedAsync($"DELETE FROM [dbo].[FraisPersonnel] WHERE [Id_Periode] = {periodId}", ct);
        foreach (var row in GetRows(root, "fraisPersonnelRows"))
        {
            var lineId = await EnsureLineAsync("FraisPersonnel_Lignes", GetString(row, "designation"), ct);
            await _context.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO [dbo].[FraisPersonnel]([Id_Designation_FraisPersonnel],[Id_Periode],[M_1],[M]) VALUES ({lineId},{periodId},{ParseDecimal(GetString(row, "m1"))},{ParseDecimal(GetString(row, "m"))})", ct);
        }
    }

    private async Task SaveEffectifGspAsync(int periodId, JsonElement root, CancellationToken ct)
    {
        await _context.Database.ExecuteSqlInterpolatedAsync($"DELETE FROM [dbo].[EffectifGSP] WHERE [Id_Periode] = {periodId}", ct);
        foreach (var row in GetRows(root, "effectifGspRows"))
        {
            var lineId = await EnsureLineAsync("EffectifGSP_Lignes", GetString(row, "gsp"), ct);
            await _context.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO [dbo].[EffectifGSP]([Id_Designation_EffectifGSP],[Id_Periode],[M_1],[M],[Part]) VALUES ({lineId},{periodId},{ParseDecimal(GetString(row, "m1"))},{ParseDecimal(GetString(row, "m"))},{ParseDecimal(GetString(row, "part"))})", ct);
        }
    }

    private async Task SaveAbsenteismeAsync(int periodId, JsonElement root, CancellationToken ct)
    {
        await _context.Database.ExecuteSqlInterpolatedAsync($"DELETE FROM [dbo].[Absenteisme] WHERE [Id_Periode] = {periodId}", ct);
        foreach (var row in GetRows(root, "absenteismeRows"))
        {
            var lineId = await EnsureLineAsync("Absenteisme_Lignes", GetString(row, "motif"), ct);
            await _context.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO [dbo].[Absenteisme]([Id_Designation_Absenteisme],[Id_Periode],[M_1],[M],[Part]) VALUES ({lineId},{periodId},{ParseDecimal(GetString(row, "m1"))},{ParseDecimal(GetString(row, "m"))},{ParseDecimal(GetString(row, "part"))})", ct);
        }
    }

    private async Task SaveMouvEffectifsAsync(int periodId, JsonElement root, CancellationToken ct)
    {
        await _context.Database.ExecuteSqlInterpolatedAsync($"DELETE FROM [dbo].[MouvEffectifs] WHERE [Id_Periode] = {periodId}", ct);
        foreach (var row in GetRows(root, "mouvementEffectifsRows"))
        {
            var lineId = await EnsureLineAsync("MouvEffectifs_Lignes", $"{GetString(row, "bloc")}-{GetString(row, "operation")}", ct);
            await _context.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO [dbo].[MouvEffectifs]([Id_Designation_MouvEffectifs],[Id_Periode],[M_1_CadresSup],[M_1_Cadres],[M_1_Maitrise],[M_1_Execution],[M_CadresSup],[M_Cadres],[M_Maitrise],[M_Execution]) VALUES ({lineId},{periodId},{ParseDecimal(GetString(row, "m1CadresSup"))},{ParseDecimal(GetString(row, "m1Cadres"))},{ParseDecimal(GetString(row, "m1Maitrise"))},{ParseDecimal(GetString(row, "m1Execution"))},{ParseDecimal(GetString(row, "mCadresSup"))},{ParseDecimal(GetString(row, "mCadres"))},{ParseDecimal(GetString(row, "mMaitrise"))},{ParseDecimal(GetString(row, "mExecution"))})", ct);
        }
    }

    private async Task SaveFormationGspAsync(int periodId, JsonElement root, CancellationToken ct)
    {
        await _context.Database.ExecuteSqlInterpolatedAsync($"DELETE FROM [dbo].[FormationGSP] WHERE [Id_Periode] = {periodId}", ct);
        foreach (var row in GetRows(root, "effectifsFormesGspRows"))
        {
            var lineId = await EnsureLineAsync("FormationGSP_Lignes", GetString(row, "gsp"), ct);
            await _context.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO [dbo].[FormationGSP]([Id_Designation_FormationGSP],[Id_Periode],[M_1_Objectif],[M_1_Realise],[M_1_Taux],[M_Objectif],[M_Realise],[M_Taux]) VALUES ({lineId},{periodId},{ParseDecimal(GetString(row, "m1Objectif"))},{ParseDecimal(GetString(row, "m1Realise"))},{ParseDecimal(GetString(row, "m1Taux"))},{ParseDecimal(GetString(row, "mObjectif"))},{ParseDecimal(GetString(row, "mRealise"))},{ParseDecimal(GetString(row, "mTaux"))})", ct);
        }
    }

    private async Task SaveFormationDomAsync(int periodId, JsonElement root, CancellationToken ct)
    {
        await _context.Database.ExecuteSqlInterpolatedAsync($"DELETE FROM [dbo].[FormationDom] WHERE [Id_Periode] = {periodId}", ct);
        foreach (var row in GetRows(root, "formationsDomainesRows"))
        {
            var lineId = await EnsureLineAsync("FormationDom_Lignes", GetString(row, "domaine"), ct);
            await _context.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO [dbo].[FormationDom]([Id_Designation_FormationDom],[Id_Periode],[M_1_Objectif],[M_1_Realise],[M_1_Taux],[M_Objectif],[M_Realise],[M_Taux]) VALUES ({lineId},{periodId},{ParseDecimal(GetString(row, "m1Objectif"))},{ParseDecimal(GetString(row, "m1Realise"))},{ParseDecimal(GetString(row, "m1Taux"))},{ParseDecimal(GetString(row, "mObjectif"))},{ParseDecimal(GetString(row, "mRealise"))},{ParseDecimal(GetString(row, "mTaux"))})", ct);
        }
    }
}
