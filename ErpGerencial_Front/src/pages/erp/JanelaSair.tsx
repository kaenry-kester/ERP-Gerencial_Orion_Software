import { useEffect, useRef } from 'react'

type Props = {
  aberto: boolean
  fechando: boolean
  erro: string | null
  /** Faz a última cópia e fecha o Órion, o WhatsApp e o banco. */
  onFecharTudo: () => void
  /** Só sai da conta (o Órion continua aberto). */
  onSoSair: () => void
  onCancelar: () => void
}

/** "Sair" no computador da loja: fechar o Órion inteiro (sem precisar do Gerenciador de Tarefas) ou só sair da conta. */
export default function JanelaSair({ aberto, fechando, erro, onFecharTudo, onSoSair, onCancelar }: Props) {
  const janela = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = janela.current
    if (!d) return
    if (aberto && !d.open) d.showModal()
    else if (!aberto && d.open) d.close()
  }, [aberto])

  return (
    <dialog
      ref={janela}
      className="janela-sair"
      aria-labelledby="janela-sair-titulo"
      onCancel={(e) => {
        e.preventDefault()
        if (!fechando) onCancelar()
      }}
    >
      <h2 id="janela-sair-titulo">Sair do Órion</h2>
      <p>
        <strong>Fechar o Órion</strong> faz uma cópia de segurança e fecha tudo: o sistema, o WhatsApp e o banco de
        dados. Tudo o que foi cadastrado fica salvo. Para abrir de novo, use o atalho “Órion” da Área de Trabalho.
      </p>
      {erro && (
        <p className="janela-sair-erro" role="alert">
          {erro}
        </p>
      )}
      <div className="janela-sair-botoes">
        <button type="button" className="pagina-botao perigo" onClick={onFecharTudo} disabled={fechando} autoFocus>
          {fechando ? 'Fechando...' : 'Fechar o Órion'}
        </button>
        <button type="button" className="pagina-botao claro" onClick={onSoSair} disabled={fechando}>
          Só sair da conta
        </button>
        <button type="button" className="pagina-botao neutro" onClick={onCancelar} disabled={fechando}>
          Cancelar
        </button>
      </div>
    </dialog>
  )
}
