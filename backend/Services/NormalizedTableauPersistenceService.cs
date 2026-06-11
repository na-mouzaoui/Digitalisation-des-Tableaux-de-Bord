using System.Globalization;
using System.Runtime.CompilerServices;
using DigitalisationDesTableauxDeBordAPI.Data;
using DigitalisationDesTableauxDeBordAPI.Models;
using Microsoft.EntityFrameworkCore;

namespace DigitalisationDesTableauxDeBordAPI.Services;

public class NormalizedTableauPersistenceService : INormalizedTableauPersistenceService
{
    private readonly AppDbContext _context;

    public NormalizedTableauPersistenceService(AppDbContext context)
    {
        _context = context;
    }

    public async Task DeleteValeursAsync(string tabKey, string mois, string annee, string direction, CancellationToken ct = default)
    {
        var kpiId = await _context.Database.SqlQuery<int>($"SELECT TOP 1 [Id] AS [Value] FROM [dbo].[Kpis] WHERE [Nom] = {tabKey} ORDER BY [Id]").FirstOrDefaultAsync(ct);
        if (kpiId == 0) return;

        var periodId = await GetPeriodIdAsync(mois, annee, ct);
        if (periodId == 0) return;

        await _context.Database.ExecuteSqlInterpolatedAsync(
            $"DELETE FROM [dbo].[Valeurs] WHERE [Id_Periode] = {periodId} AND [Id_SousKpi] IN (SELECT [Id] FROM [dbo].[SousKpis] WHERE [KpiId] = {kpiId}) AND [UserId] IN (SELECT [Id] FROM [dbo].[Users] WHERE [Direction] = {direction})", ct);
    }

    public async Task PersistAsync(SaveValeursRequest request, int userId, string resolvedDirection, CancellationToken ct = default)
    {
        var tabKey = (request.TabKey ?? string.Empty).Trim().ToLowerInvariant();
        var kpiId = await _context.Database.SqlQuery<int>($"SELECT TOP 1 [Id] AS [Value] FROM [dbo].[Kpis] WHERE [Nom] = {tabKey} ORDER BY [Id]").FirstOrDefaultAsync(ct);
        if (kpiId == 0) return;

        var periodId = await EnsurePeriodAsync(request.Mois, request.Annee, ct);
        var hasDataJson = !string.IsNullOrWhiteSpace(request.DataJson);

        await _context.Database.ExecuteSqlInterpolatedAsync(
            $"DELETE FROM [dbo].[Valeurs] WHERE [Id_Periode] = {periodId} AND [Id_SousKpi] IN (SELECT [Id] FROM [dbo].[SousKpis] WHERE [KpiId] = {kpiId}) AND [UserId] IN (SELECT [Id] FROM [dbo].[Users] WHERE [Direction] = {resolvedDirection})", ct);

        var rowsInserted = 0;

        foreach (var row in request.Rows)
        {
            var sousKpiId = 0;
            var designation = (row.Designation ?? string.Empty).Trim();

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
                        $"SELECT TOP 1 [Id] AS [Value] FROM [dbo].[SousKpis] WHERE [KpiId] = {kpiId} AND [Designation] = {designation} ORDER BY [Id]").FirstAsync(ct);
                }
            }

            var now = DateTime.UtcNow;
            var cols = new List<string> { "Id_SousKpi", "Id_Periode", "UserId", "CreatedAt", "UpdatedAt" };
            var vals = new List<object> { sousKpiId, periodId, userId, now, now };

            if (hasDataJson)
            {
                cols.Add("[DataJson]");
                vals.Add(request.DataJson!);
            }

            void AddColumn(string colName, decimal? value)
            {
                if (value.HasValue)
                {
                    cols.Add($"[{colName}]");
                    vals.Add(value.Value);
                }
            }

            void AddStringColumn(string colName, string? value)
            {
                if (!string.IsNullOrWhiteSpace(value))
                {
                    cols.Add($"[{colName}]");
                    vals.Add(value);
                }
            }

            AddColumn("M", row.M);
            AddColumn("M_1", row.M_1);
            AddColumn("Evol", row.Evol);
            AddColumn("Part_Pct", row.Part_Pct);
            AddColumn("Ecart", row.Ecart);
            AddColumn("Objectif_2026", row.Objectif_2026);
            AddStringColumn("Situation_Actuelle", row.Situation_Actuelle);
            AddColumn("M_Objectif", row.M_Objectif);
            AddColumn("M_Realise", row.M_Realise);
            AddColumn("M_Taux", row.M_Taux);
            AddColumn("M_1_Objectif", row.M_1_Objectif);
            AddColumn("M_1_Realise", row.M_1_Realise);
            AddColumn("M_1_Taux", row.M_1_Taux);
            AddStringColumn("M_Wilaya", row.M_Wilaya);
            AddColumn("Taux_M", row.Taux_M);
            AddColumn("Taux_M_1", row.Taux_M_1);
            AddColumn("M_1_Montant_Recouvre", row.M_1_Montant_Recouvre);
            AddColumn("M_Montant_Mis_Recouvrement", row.M_Montant_Mis_Recouvrement);
            AddColumn("M_Montant_Recouvre", row.M_Montant_Recouvre);
            AddColumn("M_Taux_Recouvrement", row.M_Taux_Recouvrement);
            AddColumn("M_Objectif_Recouvrement", row.M_Objectif_Recouvrement);
            AddColumn("M_1_Recrute", row.M_1_Recrute);
            AddColumn("M_Recrute", row.M_Recrute);
            AddColumn("MTTR_Objectif", row.MTTR_Objectif);
            AddColumn("MTTR_Realise", row.MTTR_Realise);
            AddColumn("MTTR_Ecart", row.MTTR_Ecart);
            AddColumn("Debit_Objectif", row.Debit_Objectif);
            AddColumn("Debit_Realise", row.Debit_Realise);
            AddColumn("Debit_Ecart", row.Debit_Ecart);
            AddColumn("M_1_Cadres_Sup", row.M_1_Cadres_Sup);
            AddColumn("M_1_Cadres", row.M_1_Cadres);
            AddColumn("M_1_Maitrise", row.M_1_Maitrise);
            AddColumn("M_1_Execution", row.M_1_Execution);
            AddColumn("M_Cadres_Sup", row.M_Cadres_Sup);
            AddColumn("M_Cadres", row.M_Cadres);
            AddColumn("M_Maitrise", row.M_Maitrise);
            AddColumn("M_Execution", row.M_Execution);
            AddColumn("M_1_CDI", row.M_1_CDI);
            AddColumn("M_1_CDD", row.M_1_CDD);
            AddColumn("M_1_CTA", row.M_1_CTA);
            AddColumn("M_CDI", row.M_CDI);
            AddColumn("M_CDD", row.M_CDD);
            AddColumn("M_CTA", row.M_CTA);

            if (cols.Count <= 3 || sousKpiId == 0) continue;

            var colList = string.Join(",", cols);
            var paramList = string.Join(",", vals.Select((_, i) => $"{{{i}}}"));
            var format = $"INSERT INTO [dbo].[Valeurs]({colList}) VALUES ({paramList})";
            var fs = FormattableStringFactory.Create(format, vals.ToArray());
            await _context.Database.ExecuteSqlInterpolatedAsync(fs, ct);
            rowsInserted++;
        }

        if (rowsInserted == 0 && hasDataJson)
        {
            var firstSousKpiId = await _context.Database.SqlQuery<int>(
                $"SELECT TOP 1 [Id] AS [Value] FROM [dbo].[SousKpis] WHERE [KpiId] = {kpiId} ORDER BY [Id]").FirstOrDefaultAsync(ct);
            if (firstSousKpiId > 0)
            {
                var now2 = DateTime.UtcNow;
                await _context.Database.ExecuteSqlInterpolatedAsync(
                    $"INSERT INTO [dbo].[Valeurs]([Id_SousKpi],[Id_Periode],[UserId],[DataJson],[CreatedAt],[UpdatedAt]) VALUES ({firstSousKpiId},{periodId},{userId},{request.DataJson},{now2},{now2})", ct);
            }
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

    private async Task<int> GetPeriodIdAsync(string mois, string annee, CancellationToken ct)
    {
        var m = ParseInt(mois);
        var y = ParseInt(annee);
        return await _context.Database.SqlQuery<int>($"SELECT TOP 1 [Id] AS [Value] FROM [dbo].[Periode] WHERE [Mois] = {m} AND [Annee] = {y}").FirstOrDefaultAsync(ct);
    }

    private static int ParseInt(string? value)
    {
        return int.TryParse((value ?? string.Empty).Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var v) ? v : 0;
    }

}
