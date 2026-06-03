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

        await SaveToValeursAsync(periodId, tabKey, root, resolvedDirection, cancellationToken);
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

    private async Task SaveToValeursAsync(int periodId, string tabKey, JsonElement root, string direction, CancellationToken ct)
    {
        var kpiId = await _context.Database.SqlQuery<int>($"SELECT TOP 1 [Id] AS [Value] FROM [dbo].[Kpis] WHERE [Nom] = {tabKey} ORDER BY [Id]").FirstOrDefaultAsync(ct);
        if (kpiId == 0) return;

        await _context.Database.ExecuteSqlInterpolatedAsync(
            $"DELETE FROM [dbo].[Valeurs] WHERE [Id_Periode] = {periodId} AND [Id_SousKpi] IN (SELECT [Id] FROM [dbo].[SousKpis] WHERE [KpiId] = {kpiId})", ct);

        var (arrayProp, designationField, fieldMappings) = tabKey switch
        {
            "reclamation" => ("reclamationRows", "", new (string, string)[] { }),
            "e_payement" => ("ePayementPopRows", "rechargement", new[] { ("m1", "M_1"), ("m", "M"), ("evol", "Evol") }),
            "total_encaissement" => ("totalEncaissementRows", "", new[] { ("m1Gp", "M_1"), ("m1B2b", "M_1"), ("mGp", "M"), ("mB2b", "M"), ("evol", "Evol") }),
            "rechargement" => ("rechargementRows", "canal", new[] { ("m1", "M_1"), ("m", "M"), ("taux", "Taux_M") }),
            "recouvrement" => ("recouvrementRows", "label", new[] { ("m1Gp", "M_1"), ("m1B2b", "M_1"), ("mGp", "M"), ("mB2b", "M") }),
            "chiffre_affaires_mda" => ("chiffreAffairesMdaRows", "designation", new[] { ("m1Objectif", "M_1_Objectif"), ("m1Realise", "M_1_Realise"), ("m1Taux", "M_1_Taux"), ("mObjectif", "M_Objectif"), ("mRealise", "M_Realise"), ("mTaux", "M_Taux") }),
            "parc_abonnes_gp" => ("parcAbonnesGpRows", "designation", new[] { ("m1", "M_1"), ("m", "M"), ("evol", "Evol") }),
            "total_parc_abonnes_technologie" => ("totalParcAbonnesTechnologieRows", "designation", new[] { ("m1", "M_1"), ("m", "M"), ("evol", "Evol") }),
            "activation" => ("activationRows", "designation", new[] { ("m1", "M_1"), ("m", "M"), ("evol", "Evol") }),
            "realisation_technique_reseau" => ("realisationTechniqueReseauRows", "label", new[] { ("m1", "M_1"), ("m", "M") }),
            "situation_reseau" => ("situationReseauRows", "", new[] { ("m1", "M_1"), ("m", "M") }),
            "trafic_data" => ("traficDataRows", "label", new[] { ("m1", "M_1"), ("m", "M") }),
            "amelioration_qualite" => ("ameliorationQualiteRows", "", new[] { ("m1Objectif", "M_1_Objectif"), ("m1Realise", "M_1_Realise"), ("mObjectif", "M_Objectif"), ("mRealise", "M_Realise"), ("ecart", "Ecart") }),
            "couverture_reseau" => ("couvertureReseauRows", "", new[] { ("m1Objectif", "M_1_Objectif"), ("m1Realise", "M_1_Realise"), ("mObjectif", "M_Objectif"), ("mRealise", "M_Realise") }),
            "action_notable_reseau" => ("actionNotableReseauRows", "action", new[] { ("m1Objectif", "M_1_Objectif"), ("m1Realise", "M_1_Realise"), ("m1Taux", "M_1_Taux"), ("mObjectif", "M_Objectif"), ("mRealise", "M_Realise"), ("mTaux", "M_Taux") }),
            "disponibilite_reseau" => ("disponibiliteReseauRows", "designation", new[] { ("m1Objectif", "M_1_Objectif"), ("m1Realise", "M_1_Realise"), ("m1Taux", "M_1_Taux"), ("mObjectif", "M_Objectif"), ("mRealise", "M_Realise"), ("mTaux", "M_Taux") }),
            "mttr" => ("mttrRows", "", new (string, string)[] { }),
            "creances_contentieuses" => ("recouvrementRows", "designation", new[] { ("m1Montant", "M_1_Montant_Recouvre"), ("mMontant", "M_Montant_Recouvre"), ("mTaux", "M_Taux_Recouvrement") }),
            "creances_contentieuses_anterieur" => ("recouvrementAnterieurRows", "designation", new[] { ("m1Montant", "M_1_Montant_Recouvre"), ("mMontant", "M_Montant_Recouvre"), ("mTaux", "M_Taux_Recouvrement") }),
            "frais_personnel" => ("fraisPersonnelRows", "designation", new[] { ("m1", "M_1"), ("m", "M") }),
            "effectif_gsp" => ("effectifGspRows", "gsp", new[] { ("m1", "M_1"), ("m", "M"), ("part", "Part_Pct") }),
            "absenteisme" => ("absenteismeRows", "motif", new[] { ("m1", "M_1"), ("m", "M"), ("part", "Part_Pct") }),
            "mouvement_effectifs" => ("mouvementEffectifsRows", "", new[] { ("m1CadresSup", "M_1_Cadres_Sup"), ("m1Cadres", "M_1_Cadres"), ("m1Maitrise", "M_1_Maitrise"), ("m1Execution", "M_1_Execution"), ("mCadresSup", "M_Cadres_Sup"), ("mCadres", "M_Cadres"), ("mMaitrise", "M_Maitrise"), ("mExecution", "M_Execution") }),
            "mouvement_effectifs_domaine" => ("mouvementEffectifsDomaineRows", "", new[] { ("m1Cdi", "M_1_CDI"), ("m1Cdd", "M_1_CDD"), ("m1Cta", "M_1_CTA"), ("mCdi", "M_CDI"), ("mCdd", "M_CDD"), ("mCta", "M_CTA") }),
            "effectifs_formes_gsp" => ("effectifsFormesGspRows", "gsp", new[] { ("m1Objectif", "M_1_Objectif"), ("m1Realise", "M_1_Realise"), ("m1Taux", "M_1_Taux"), ("mObjectif", "M_Objectif"), ("mRealise", "M_Realise"), ("mTaux", "M_Taux") }),
            "formations_domaines" => ("formationsDomainesRows", "domaine", new[] { ("m1Objectif", "M_1_Objectif"), ("m1Realise", "M_1_Realise"), ("m1Taux", "M_1_Taux"), ("mObjectif", "M_Objectif"), ("mRealise", "M_Realise"), ("mTaux", "M_Taux") }),
            "genie_civil" => ("genieCivilRows", "label", new[] { ("m1Realise", "M_1_Realise"), ("m1Objectif", "M_1_Objectif"), ("mRealise", "M_Realise"), ("mTaux", "M_Taux") }),
            "maintenance_equipement" => ("maintenanceEquipementRows", "label", new[] { ("m1Realise", "M_1_Realise"), ("m1Objectif", "M_1_Objectif"), ("mRealise", "M_Realise"), ("mTaux", "M_Taux") }),
            "nouveaux_sites" => ("nouveauxSitesRows", "label", new[] { ("m1Realise", "M_1_Realise"), ("m1Objectif", "M_1_Objectif"), ("mRealise", "M_Realise"), ("mTaux", "M_Taux") }),
            "realisations_commerciales" => ("commercialeDrRows", "label", new[] { ("m1Realise", "M_1_Realise"), ("m1Objectif", "M_1_Objectif"), ("mRealise", "M_Realise"), ("mTaux", "M_Taux") }),
            _ => ("", "", Array.Empty<(string, string)>()),
        };

        if (string.IsNullOrEmpty(arrayProp)) return;

        foreach (var row in GetRows(root, arrayProp))
        {
            var designation = string.IsNullOrEmpty(designationField) ? "" : GetString(row, designationField);
            var sousKpiId = 0;

            if (!string.IsNullOrEmpty(designation))
            {
                sousKpiId = await _context.Database.SqlQuery<int>(
                    $"SELECT TOP 1 [Id] AS [Value] FROM [dbo].[SousKpis] WHERE [KpiId] = {kpiId} AND [Designation] = {designation} ORDER BY [Id]")
                    .FirstOrDefaultAsync(ct);

                if (sousKpiId == 0)
                {
                    var maxOrder = await _context.Database.SqlQuery<int>(
                        $"SELECT ISNULL(MAX([Order]), 0) AS [Value] FROM [dbo].[SousKpis] WHERE [KpiId] = {kpiId}").FirstAsync(ct);
                    await _context.Database.ExecuteSqlInterpolatedAsync(
                        $"INSERT INTO [dbo].[SousKpis]([KpiId],[Designation],[Order]) VALUES ({kpiId},{designation},{maxOrder + 1})", ct);
                    sousKpiId = await _context.Database.SqlQuery<int>(
                        $"SELECT [Id] AS [Value] FROM [dbo].[SousKpis] WHERE [KpiId] = {kpiId} AND [Designation] = {designation} ORDER BY [Id]").FirstAsync(ct);
                }
            }

            var cols = new List<string> { "Id_SousKpi", "Id_Periode" };
            var vals = new List<string> { sousKpiId.ToString(), periodId.ToString() };

            foreach (var (dataField, colName) in fieldMappings)
            {
                var val = ParseDecimal(GetString(row, dataField));
                if (val.HasValue)
                {
                    cols.Add($"[{colName}]");
                    vals.Add(val.Value.ToString(CultureInfo.InvariantCulture));
                }
            }

            if (cols.Count <= 2) continue;

            var sql = $"INSERT INTO [dbo].[Valeurs]({string.Join(",", cols)}) VALUES ({string.Join(",", vals)})";
            await _context.Database.ExecuteSqlRawAsync(sql, ct);
        }

        if (tabKey == "realisations_commerciales")
        {
            foreach (var row in GetRows(root, "reseauDistributionRows"))
            {
                var designation = GetString(row, "label");
                var sousKpiId = 0;
                if (!string.IsNullOrEmpty(designation))
                {
                    sousKpiId = await _context.Database.SqlQuery<int>(
                        $"SELECT TOP 1 [Id] AS [Value] FROM [dbo].[SousKpis] WHERE [KpiId] = {kpiId} AND [Designation] = {designation} ORDER BY [Id]")
                        .FirstOrDefaultAsync(ct);

                    if (sousKpiId == 0)
                    {
                        var maxOrder = await _context.Database.SqlQuery<int>(
                            $"SELECT ISNULL(MAX([Order]), 0) AS [Value] FROM [dbo].[SousKpis] WHERE [KpiId] = {kpiId}").FirstAsync(ct);
                        await _context.Database.ExecuteSqlInterpolatedAsync(
                            $"INSERT INTO [dbo].[SousKpis]([KpiId],[Designation],[Order]) VALUES ({kpiId},{designation},{maxOrder + 1})", ct);
                        sousKpiId = await _context.Database.SqlQuery<int>(
                            $"SELECT [Id] AS [Value] FROM [dbo].[SousKpis] WHERE [KpiId] = {kpiId} AND [Designation] = {designation} ORDER BY [Id]").FirstAsync(ct);
                    }
                }

                var m1Recrute = ParseDecimal(GetString(row, "m1Recrute"));
                var m1Realise = ParseDecimal(GetString(row, "m1Realise"));
                var mRecrute = ParseDecimal(GetString(row, "mRecrute"));
                var mRealise = ParseDecimal(GetString(row, "mRealise"));
                var mEcart = ParseDecimal(GetString(row, "mEcart"));
                var situation = GetString(row, "situation");

                var sql = $"INSERT INTO [dbo].[Valeurs]([Id_SousKpi],[Id_Periode],[M_1_Recrute],[M_1_Realise],[M_Recrute],[M_Realise],[Ecart],[Situation_Actuelle]) VALUES ({sousKpiId},{periodId},{m1Recrute?.ToString(CultureInfo.InvariantCulture) ?? "NULL"},{m1Realise?.ToString(CultureInfo.InvariantCulture) ?? "NULL"},{mRecrute?.ToString(CultureInfo.InvariantCulture) ?? "NULL"},{mRealise?.ToString(CultureInfo.InvariantCulture) ?? "NULL"},{mEcart?.ToString(CultureInfo.InvariantCulture) ?? "NULL"},N'{situation.Replace("'", "''")}')";
                await _context.Database.ExecuteSqlRawAsync(sql, ct);
            }
        }
    }
}
