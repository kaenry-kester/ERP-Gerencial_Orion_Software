import { useLayoutEffect, useRef } from 'react'
import { IconeFicha } from './CampoFicha'
import './ficha.css'

type Props = {
  rotulo: string
  /** Vazio aparece como "—". */
  valor: string | null | undefined
  /** Colunas da ficha (ex.: "c9"), como no CampoFicha. */
  className?: string
  /** Imagem pequena à esquerda do valor (ex.: "/imgs/whatsapp.png"). */
  icone?: string
  /** Endereço aberto ao clicar no ícone, numa aba nova (ex.: a conversa no WhatsApp); sem ele, o ícone não clica. */
  linkIcone?: string | null
  /** Dica do ícone clicável. */
  dicaIcone?: string
  /** Texto longo (ex.: observação): caixa mais alta, com quebra de linha. */
  linhas?: number
}

/** Menor letra a que um valor curto chega para caber na caixa (em pixels). */
const LETRA_MINIMA = 8

/**
 * Valor curto (telefone, CPF/CNPJ, data...) sempre inteiro numa linha: se não couber na caixa, a letra diminui só o
 * necessário. Refaz a conta quando a caixa muda de tamanho (tela menor, janela redimensionada).
 */
function useCaberNaCaixa(ativo: boolean, texto: string) {
  const ref = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const span = ref.current
    if (!ativo || !span?.parentElement) return
    const ajustar = () => {
      span.style.fontSize = ''
      let tamanho = parseFloat(getComputedStyle(span).fontSize)
      while (span.scrollWidth > span.clientWidth && tamanho > LETRA_MINIMA) {
        tamanho -= 0.25
        span.style.fontSize = `${tamanho}px`
      }
    }
    ajustar()
    const observador = new ResizeObserver(ajustar)
    observador.observe(span.parentElement)
    return () => observador.disconnect()
  }, [ativo, texto])
  return ref
}

/**
 * Campo da ficha só para ver (páginas de detalhes do cliente e do produto): o mesmo rótulo em negrito e a mesma
 * caixa retangular do CampoFicha do cadastro, com o valor salvo dentro.
 */
export default function ValorFicha({ rotulo, valor, className, icone, linkIcone, dicaIcone, linhas }: Props) {
  const texto = valor?.trim() ? valor : '—'
  // Valor curto (telefone, CPF/CNPJ, data, CEP, R$...): sempre numa linha só e inteiro, nunca partido nem cortado
  const curto = !linhas && texto.length <= 20
  const ref = useCaberNaCaixa(curto, texto)
  return (
    <div className={['ficha-campo', className].filter(Boolean).join(' ')}>
      <div className="ficha-cabecalho">
        <span className="ficha-rotulo">{rotulo}</span>
      </div>
      <div
        className={linhas ? 'ficha-valor longo' : curto ? 'ficha-valor curto' : 'ficha-valor'}
        style={linhas ? { minHeight: `${linhas * 1.3 + 0.6}em` } : undefined}
        title={linhas ? undefined : texto}
      >
        {icone && <IconeFicha icone={icone} link={linkIcone} dica={dicaIcone} />}
        <span ref={ref}>{texto}</span>
      </div>
    </div>
  )
}
