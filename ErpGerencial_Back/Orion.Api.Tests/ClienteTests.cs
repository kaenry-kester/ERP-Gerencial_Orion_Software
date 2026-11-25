using System.Net;
using System.Text.Json;
using Orion.Api.Tests.Infra;

namespace Orion.Api.Tests;

/// <summary>Cadastro de cliente: o campo "Valor" (R$, opcional) e o segundo aparelho.</summary>
[Collection("api")]
public class ClienteTests(ApiDeTeste api)
{
    [Fact]
    public async Task Guarda_altera_e_apaga_o_valor()
    {
        var http = (await api.NovaConta()).Http;

        var criado = await http.Post("/api/clientes", new { nome = "Carla Valor", celular = "16988885555", valor = 349.9m });
        Assert.True(criado.Status == HttpStatusCode.Created, criado.ToString());
        Assert.Equal(349.9m, criado.Decimal("valor"));
        var id = criado.Texto("id");

        var alterado = await http.Put($"/api/clientes/{id}", new { nome = "Carla Valor", celular = "16988885555", valor = 120m });
        Assert.Equal(120m, alterado.Decimal("valor"));

        // Vazio: o cliente fica sem valor
        var vazio = await http.Put($"/api/clientes/{id}", new { nome = "Carla Valor", celular = "16988885555" });
        Assert.Equal(JsonValueKind.Null, vazio["valor"].ValueKind);

        var negativo = await http.Post("/api/clientes", new { nome = "Valor Negativo", celular = "16988886666", valor = -1m });
        Assert.Equal(HttpStatusCode.BadRequest, negativo.Status);
    }

    [Fact]
    public async Task Guarda_o_segundo_aparelho()
    {
        var http = (await api.NovaConta()).Http;
        var criado = await http.Post("/api/clientes", new
        {
            nome = "Davi Dois", celular = "16988887777", item = "Purificador", item2 = "Filtro de entrada", marca2 = "Acqua", modelo2 = "FX-2",
            valor2 = 89.5m,
        });
        Assert.True(criado.Status == HttpStatusCode.Created, criado.ToString());
        Assert.Equal("Filtro de entrada", criado.Texto("item2"));
        Assert.Equal("Acqua", criado.Texto("marca2"));
        Assert.Equal("FX-2", criado.Texto("modelo2"));
        Assert.Equal(89.5m, criado.Decimal("valor2"));
    }
}
