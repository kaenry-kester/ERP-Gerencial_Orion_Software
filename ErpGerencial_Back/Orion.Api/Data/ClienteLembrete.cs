namespace Orion.Api.Data;

/// <summary>Lembrete marcado num dia do calendário do cliente (aparece no quadro "Lembretes" e com o número azul).</summary>
public class ClienteLembrete
{
    public Guid Id { get; set; } = Guid.CreateVersion7();

    public Guid ClienteId { get; set; }
    public Cliente? Cliente { get; set; }

    public DateOnly Data { get; set; }

    public required string Texto { get; set; }

    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
}
