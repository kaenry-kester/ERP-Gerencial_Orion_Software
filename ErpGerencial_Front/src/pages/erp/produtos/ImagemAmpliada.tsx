import { useEffect, useRef, useState } from 'react'
import { IconeChevron } from '../../../components/icones/Icones'
import { urlImagemProduto } from '../../../services/api'

type Props = {
  /** Produto com as imagens a mostrar; null fecha a janela. */
  produto: { nome: string; imagens: string[] } | null
  onFechar: () => void
}

/** Foto do produto em tamanho grande, por cima da tela. Com mais de uma foto, setas (ou ← →) passam entre elas. */
export default function ImagemAmpliada({ produto, onFechar }: Props) {
  const janela = useRef<HTMLDialogElement>(null)
  const [indice, setIndice] = useState(0)
  const total = produto?.imagens.length ?? 0

  useEffect(() => {
    const d = janela.current
    if (!d) return
    if (produto && !d.open) {
      setIndice(0)
      d.showModal()
    } else if (!produto && d.open) d.close()
  }, [produto])

  const passar = (passo: number) => setIndice((i) => (i + passo + total) % total)

  return (
    // Esc, o botão de fechar ou clicar fora da foto fecham
    <dialog
      ref={janela}
      className="imagem-ampliada"
      aria-label={produto ? `Foto de ${produto.nome}` : undefined}
      onCancel={(e) => {
        e.preventDefault()
        onFechar()
      }}
      onClick={(e) => e.target === janela.current && onFechar()}
      onKeyDown={(e) => {
        if (total < 2) return
        if (e.key === 'ArrowRight') passar(1)
        if (e.key === 'ArrowLeft') passar(-1)
      }}
    >
      {produto && total > 0 && (
        <>
          <header className="imagem-ampliada-topo">
            <p>
              <strong>{produto.nome}</strong>
              {total > 1 && (
                <span>
                  {' '}
                  · foto {indice + 1} de {total}
                </span>
              )}
            </p>
            <button type="button" className="imagem-ampliada-fechar" onClick={onFechar} aria-label="Fechar">
              ×
            </button>
          </header>
          <div className="imagem-ampliada-foto">
            <img src={urlImagemProduto(produto.imagens[indice])} alt={`Foto de ${produto.nome}`} />
            {total > 1 && (
              <>
                <button type="button" className="imagem-ampliada-seta anterior" onClick={() => passar(-1)} aria-label="Foto anterior">
                  <IconeChevron tamanho={28} />
                </button>
                <button type="button" className="imagem-ampliada-seta proxima" onClick={() => passar(1)} aria-label="Próxima foto">
                  <IconeChevron tamanho={28} />
                </button>
              </>
            )}
          </div>
        </>
      )}
    </dialog>
  )
}
