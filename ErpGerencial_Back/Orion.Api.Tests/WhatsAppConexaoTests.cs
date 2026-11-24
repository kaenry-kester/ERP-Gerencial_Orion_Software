using System.Net;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Orion.Api.Data;
using Orion.Api.Tests.Infra;

namespace Orion.Api.Tests;

/// <summary>Conectar o celular que envia pelo próprio site: QR Code e situação da conexão (Evolution simulada).</summary>
[Collection("api")]
public class WhatsAppConexaoTests(ApiDeTeste api)
{
    [Fact]
    public async Task Gera_o_qr_code_e_mostra_quando_conecta()
    {
        var conta = await api.NovaConta();
        var http = conta.Http;

        // Sem número salvo: avisa e não gera QR
        Assert.Equal("sem-numero", (await http.Get("/api/whatsapp/conexao")).Texto("estado"));
        Assert.Equal(HttpStatusCode.BadRequest, (await http.Post("/api/whatsapp/conexao")).Status);

        var numero = $"169{Random.Shared.Next(10000000, 99999999)}";
        var salvo = await http.Put("/api/whatsapp", new { remetente = numero, mensagem = "Olá" });
        Assert.Equal(HttpStatusCode.OK, salvo.Status);
        Assert.Equal("desconectado", (await http.Get("/api/whatsapp/conexao")).Texto("estado"));

        // Conectar: cria a conexão desse número e devolve o QR Code e o código
        var conexao = await http.Post("/api/whatsapp/conexao");
        Assert.Equal(HttpStatusCode.OK, conexao.Status);
        Assert.Equal("aguardando", conexao.Texto("estado"));
        Assert.StartsWith("data:image/png;base64,", conexao.Texto("qrCode"));
        Assert.Equal("ABCD1234", conexao.Texto("codigo"));
        Assert.True(api.Evolution.Estados.ContainsKey(numero));

        // O celular leu o QR Code
        api.Evolution.Estados[numero] = "open";
        Assert.Equal("conectado", (await http.Get("/api/whatsapp/conexao")).Texto("estado"));
        Assert.Equal("conectado", (await http.Post("/api/whatsapp/conexao")).Texto("estado"));
    }

    [Fact]
    public async Task Tela_inicial_mostra_as_mensagens_de_hoje()
    {
        var conta = await api.NovaConta();
        var http = conta.Http;
        // Um cliente com envio marcado para hoje e outro para daqui a uma semana
        var hoje = DateTime.UtcNow.AddMinutes(30);
        var semana = DateTime.UtcNow.AddDays(7);
        var deHoje = await http.Post("/api/clientes", new { nome = "Maria de Hoje", celular = "16988881111", envioEm = hoje });
        Assert.True(deHoje.Status == HttpStatusCode.Created, deHoje.ToString());
        await http.Post("/api/clientes", new { nome = "João da Semana", celular = "16988882222", envioEm = semana });

        var lista = await http.Get("/api/whatsapp/hoje");
        Assert.Equal(HttpStatusCode.OK, lista.Status);
        var itens = lista.Json.EnumerateArray().ToList();
        // Perto da meia-noite, "daqui a 30 minutos" já é amanhã: aí a lista fica vazia
        if (Orion.Api.Horario.Local(hoje).Date == Orion.Api.Horario.Local(DateTime.UtcNow).Date)
        {
            var item = Assert.Single(itens);
            Assert.Equal("Maria de Hoje", item.GetProperty("nome").GetString());
            Assert.Equal("agendada", item.GetProperty("situacao").GetString());
        }
        Assert.DoesNotContain(itens, i => i.GetProperty("nome").GetString() == "João da Semana");
        // Uma linha por cliente (sem repetir)
        Assert.Equal(itens.Count, itens.Select(i => i.GetProperty("clienteId").GetString()).Distinct().Count());
    }

    [Fact]
    public async Task Tela_inicial_mostra_o_que_saiu_hoje_mesmo_marcado_para_outro_dia()
    {
        var conta = await api.NovaConta();
        var http = conta.Http;
        var atrasada = await http.Post("/api/clientes", new { nome = "Rita Atrasada", celular = "16988883333" });
        var enviada = await http.Post("/api/clientes", new { nome = "Paulo Enviado", celular = "16988884444" });
        var idAtrasada = Guid.Parse(atrasada.Texto("id"));
        var idEnviada = Guid.Parse(enviada.Texto("id"));

        using (var escopo = api.Services.CreateScope())
        {
            var db = escopo.ServiceProvider.GetRequiredService<OrionDbContext>();
            var ontem = DateTime.UtcNow.AddDays(-1);
            // Marcada para ontem (Órion fechado): continua na fila hoje
            await db.Clientes.Where(c => c.Id == idAtrasada)
                .ExecuteUpdateAsync(s => s.SetProperty(c => c.EnvioEm, ontem));
            // Marcada para ontem, mas saiu agora (quando o Órion abriu)
            var cliente = await db.Clientes.SingleAsync(c => c.Id == idEnviada);
            db.EnviosWhatsapp.Add(new EnvioWhatsapp
            {
                EmpresaId = cliente.EmpresaId,
                ClienteId = cliente.Id,
                DataReferencia = DateOnly.FromDateTime(Orion.Api.Horario.Local(ontem)),
                Tipo = "agendado",
                Telefone = cliente.Celular,
                Mensagem = "Olá",
                Status = "enviado",
            });
            await db.SaveChangesAsync();
        }

        var itens = (await http.Get("/api/whatsapp/hoje")).Json.EnumerateArray().ToList();
        Assert.Equal("enviada", itens.Single(i => i.GetProperty("nome").GetString() == "Paulo Enviado")
            .GetProperty("situacao").GetString());
        Assert.Equal("agendada", itens.Single(i => i.GetProperty("nome").GetString() == "Rita Atrasada")
            .GetProperty("situacao").GetString());
    }
}
