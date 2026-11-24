using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Orion.Api.Migrations
{
    /// <inheritdoc />
    public partial class FornecedorDoProdutoEFolhaDoOrcamento : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "fornecedor_nome",
                table: "produtos",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "fornecedor_telefone",
                table: "produtos",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "telefone_comercial",
                table: "produtos",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "cliente_endereco",
                table: "orcamentos",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "cliente_telefone",
                table: "orcamentos",
                type: "character varying(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "condicoes",
                table: "orcamentos",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "data",
                table: "orcamentos",
                type: "date",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "fornecedor_nome",
                table: "produtos");

            migrationBuilder.DropColumn(
                name: "fornecedor_telefone",
                table: "produtos");

            migrationBuilder.DropColumn(
                name: "telefone_comercial",
                table: "produtos");

            migrationBuilder.DropColumn(
                name: "cliente_endereco",
                table: "orcamentos");

            migrationBuilder.DropColumn(
                name: "cliente_telefone",
                table: "orcamentos");

            migrationBuilder.DropColumn(
                name: "condicoes",
                table: "orcamentos");

            migrationBuilder.DropColumn(
                name: "data",
                table: "orcamentos");
        }
    }
}
