using DigitalisationDesTableauxDeBordAPI.Models;

namespace DigitalisationDesTableauxDeBordAPI.Services;

public interface INormalizedTableauPersistenceService
{
    Task PersistAsync(SaveValeursRequest request, int userId, string resolvedDirection, CancellationToken cancellationToken = default);
    Task DeleteValeursAsync(string tabKey, string mois, string annee, string direction, CancellationToken cancellationToken = default);
}
