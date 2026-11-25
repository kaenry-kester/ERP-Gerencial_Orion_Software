import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CUPOM_ALTURA_MINIMA_MM, CUPOM_LARGURA_MM, esperarImagens } from './pdfCupom'
// As regras da impressão (só o documento sai no papel) vêm junto com quem imprime, em qualquer página
import './impressao.css'

/**
 * Impressão do cupom ou do orçamento: `imprimir()` abre a janela de impressão já no tamanho do papel — cupom de
 * 58 mm de largura (a altura acompanha o texto, no mínimo 80 mm) ou folha A4. Só o documento sai no papel (o resto
 * da página fica escondido). Coloque `elemento` em qualquer lugar da página. `documento` é o que vai no papel
 * (ex.: <CupomTermico />); null enquanto não carregou.
 */
export function useImpressao(documento: ReactNode, papel: 'bobina' | 'a4' = 'bobina') {
  const [imprimindo, setImprimindo] = useState(false)

  useEffect(() => {
    if (!imprimindo) return
    let ativo = true
    const pagina = document.createElement('style')
    const terminar = () => setImprimindo(false)
    window.addEventListener('afterprint', terminar)

    void (async () => {
      const montado = document.querySelector<HTMLElement>('.impressao-cupom')
      // Sem isso a logo pode sair cortada ou em branco (e o cupom seria medido sem ela)
      if (montado) await esperarImagens(montado)
      if (papel === 'a4') pagina.textContent = '@page { size: A4; margin: 10mm; }'
      else {
        // Largura fixa de 58 mm; a altura é a do cupom já montado (fora da tela), com 2 mm de folga para o corte
        const altura = montado?.querySelector('.ct')?.getBoundingClientRect().height ?? 0
        const alturaMm = Math.max(Math.ceil((altura * 25.4) / 96) + 2, CUPOM_ALTURA_MINIMA_MM)
        pagina.textContent =
          `@page { size: ${CUPOM_LARGURA_MM}mm ${alturaMm}mm; margin: 0; }` +
          // Sem margens nem altura mínima da página: o papel tem só o cupom
          'html, body { margin: 0 !important; padding: 0 !important; height: auto !important; }'
      }
      if (!ativo) return
      document.head.appendChild(pagina)
      document.body.classList.add('imprimindo')
      // Espera o navegador aplicar o tamanho do papel antes de abrir a janela de impressão
      window.setTimeout(() => ativo && window.print(), 50)
    })()

    return () => {
      ativo = false
      window.removeEventListener('afterprint', terminar)
      pagina.remove()
      document.body.classList.remove('imprimindo')
    }
  }, [imprimindo, papel])

  const elemento =
    documento && imprimindo
      ? createPortal(<div className="impressao impressao-cupom">{documento}</div>, document.body)
      : null

  return { imprimir: () => setImprimindo(true), imprimindo, elemento }
}
