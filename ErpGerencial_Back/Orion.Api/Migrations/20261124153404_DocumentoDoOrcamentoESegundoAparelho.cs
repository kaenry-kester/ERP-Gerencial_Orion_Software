using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Orion.Api.Migrations
{
    /// <inheritdoc />
    public partial class DocumentoDoOrcamentoESegundoAparelho : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "cliente_documento",
                table: "orcamentos",
                type: "character varying(14)",
                maxLength: 14,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "item2",
                table: "clientes",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "marca2",
                table: "clientes",
                type: "character varying(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "modelo2",
                table: "clientes",
                type: "character varying(80)",
                maxLength: 80,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "cliente_documento",
                table: "orcamentos");

            migrationBuilder.DropColumn(
                name: "item2",
                table: "clientes");

            migrationBuilder.DropColumn(
                name: "marca2",
                table: "clientes");

            migrationBuilder.DropColumn(
                name: "modelo2",
                table: "clientes");
        }
    }
}
