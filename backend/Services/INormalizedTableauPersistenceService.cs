using DigitalisationDesTableauxDeBordAPI.Controllers;

namespace DigitalisationDesTableauxDeBordAPI.Services;

public interface INormalizedTableauPersistenceService
{
    Task PersistAsync(TableauRequest request, string resolvedDirection, CancellationToken cancellationToken = default);
}
