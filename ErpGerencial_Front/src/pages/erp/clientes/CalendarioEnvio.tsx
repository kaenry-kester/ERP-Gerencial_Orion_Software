import { useEffect, useRef, useState } from 'react'
import { IconeLixeira } from '../../../components/icones/Icones'
import type { Lembrete } from '../../../services/api'
import { feriado } from './feriados'

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]
const SEMANA = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']
const SEMANA_NOME = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

/** Linhas do quadro de lembretes embaixo do calendário (mínimo; cresce quando há mais). */
const LINHAS_QUADRO = 3
const LEMBRETE_MAXIMO = 200

const dois = (n: number) => String(n).padStart(2, '0')
const paraDia = (ano: number, mes: number, dia: number) => `${ano}-${dois(mes + 1)}-${dois(dia)}`

/** "2026-12-14" → "segunda-feira, 14 de dezembro de 2026" */
const diaPorExtenso = (dia: string) => {
  const [a, m, d] = dia.split('-').map(Number)
  return new Date(a!, m! - 1, d!).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/** Seta desenhada (o caractere ‹ › fica baixo no botão, preso à linha de base da fonte). */
const Seta = ({ direcao }: { direcao: 'esquerda' | 'direita' }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path
      d={direcao === 'esquerda' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}
      fill="none"
      stroke="currentColor"
      strokeWidth="3.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

/** Sino do lembrete. */
const IconeSino = ({ tamanho = 44 }: { tamanho?: number }) => (
  <svg viewBox="0 0 24 24" width={tamanho} height={tamanho} aria-hidden="true" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z" />
    <path d="M10 20.5a2 2 0 0 0 4 0" />
    <path d="M12 3V2" />
  </svg>
)

/** Abre e fecha um <dialog> como janela por cima da tela. */
function useJanela(aberta: boolean) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (aberta && !d.open) d.showModal()
    else if (!aberta && d.open) d.close()
  }, [aberta])
  return ref
}

type Props = {
  id: string
  /** Dia escolhido para o próximo envio ("2026-12-14") ou vazio. */
  dia: string
  /** Horário do envio ("08:00"), para o quadro. */
  hora: string
  /** Envios já agendados (o escolhido e os seguintes): número verde no calendário. */
  agendados: string[]
  /** Lembretes do cliente: número azul no calendário e uma linha no quadro. */
  lembretes: Lembrete[]
  onEscolher: (dia: string) => void
  onLembretes: (lembretes: Lembrete[]) => void
  /** Até quantos meses à frente dá para navegar. */
  mesesMaximo: number
  erro?: string
}

/** Linha do quadro: feriado (vermelho), lembrete (azul) ou envio automático (verde). */
type Linha =
  | { tipo: 'feriado'; dias: number[]; texto: string }
  | { tipo: 'lembrete'; dias: number[]; texto: string; indice: number }
  | { tipo: 'envio'; dias: number[]; texto: string }

/**
 * Calendário do mês no visual de folhinha de parede. Clicar num dia abre uma janela com duas opções: marcar o envio
 * da mensagem automática nesse dia ou adicionar um lembrete (que abre outra janela para digitar).
 * Números: verde = envio automático, azul = lembrete, vermelho = domingo ou feriado.
 * Embaixo, o quadro "Lembretes" lista os feriados, os lembretes e os envios do mês.
 */
export default function CalendarioEnvio({ id, dia, hora, agendados, lembretes, onEscolher, onLembretes, mesesMaximo, erro }: Props) {
  const agora = new Date()
  const hoje = paraDia(agora.getFullYear(), agora.getMonth(), agora.getDate())
  // Mês mostrado: o do dia escolhido ou o atual
  const [visto, setVisto] = useState(() => {
    const [a, m] = (dia || hoje).split('-').map(Number)
    return { ano: a!, mes: m! - 1 }
  })
  // Janela das opções do dia e janela de digitar o lembrete
  const [diaAberto, setDiaAberto] = useState<string | null>(null)
  const [escrevendo, setEscrevendo] = useState<string | null>(null)
  const [texto, setTexto] = useState('')
  const janelaDia = useJanela(diaAberto !== null)
  const janelaTexto = useJanela(escrevendo !== null)
  const campoTexto = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (escrevendo) campoTexto.current?.focus()
  }, [escrevendo])

  const indice = (visto.ano - agora.getFullYear()) * 12 + visto.mes - agora.getMonth()
  const mudarMes = (passo: number) =>
    setVisto(({ ano, mes }) => {
      const d = new Date(ano, mes + passo, 1)
      return { ano: d.getFullYear(), mes: d.getMonth() }
    })

  const primeiroDia = new Date(visto.ano, visto.mes, 1).getDay()
  const diasNoMes = new Date(visto.ano, visto.mes + 1, 0).getDate()
  // Completa a última semana para a grade fechar como numa folhinha
  const total = Math.ceil((primeiroDia + diasNoMes) / 7) * 7
  const celulas: (number | null)[] = Array.from({ length: total }, (_, i) => {
    const n = i - primeiroDia + 1
    return n >= 1 && n <= diasNoMes ? n : null
  })
  const envios = new Set(agendados)
  const comLembrete = new Set(lembretes.map((l) => l.data))

  // Quadro do mês: feriados, lembretes e os envios automáticos (todos os dias de envio numa linha só)
  const prefixo = `${visto.ano}-${dois(visto.mes + 1)}-`
  const diaDoMes = (d: string) => Number(d.slice(8))
  const linhas: Linha[] = []
  for (let n = 1; n <= diasNoMes; n++) {
    const nome = feriado(prefixo + dois(n))
    if (nome) linhas.push({ tipo: 'feriado', dias: [n], texto: nome })
  }
  lembretes.forEach((l, i) => {
    if (l.data.startsWith(prefixo)) linhas.push({ tipo: 'lembrete', dias: [diaDoMes(l.data)], texto: l.texto, indice: i })
  })
  const diasEnvio = agendados.filter((d) => d.startsWith(prefixo)).map(diaDoMes).sort((a, b) => a - b)
  if (diasEnvio.length)
    linhas.push({ tipo: 'envio', dias: diasEnvio, texto: `Mensagem automática${hora ? ` às ${hora}` : ''}` })
  linhas.sort((a, b) => a.dias[0]! - b.dias[0]!)

  const removerLembrete = (i: number) => onLembretes(lembretes.filter((_, j) => j !== i))

  const abrirLembrete = () => {
    setEscrevendo(diaAberto)
    setDiaAberto(null)
    setTexto('')
  }

  const salvarLembrete = () => {
    const limpo = texto.trim()
    if (!limpo || !escrevendo) return
    onLembretes([...lembretes, { data: escrevendo, texto: limpo }])
    setEscrevendo(null)
  }

  const lembretesDoDia = diaAberto ? lembretes.map((l, i) => ({ ...l, i })).filter((l) => l.data === diaAberto) : []
  const feriadoDoDia = diaAberto ? feriado(diaAberto) : undefined

  return (
    <div id={id} className={erro ? 'calendario com-erro' : 'calendario'} tabIndex={-1} aria-describedby={erro ? `${id}-erro` : undefined}>
      <div className="calendario-topo">
        <button type="button" onClick={() => mudarMes(-1)} disabled={indice <= 0} aria-label="Mês anterior">
          <Seta direcao="esquerda" />
        </button>
        <strong className="calendario-titulo" aria-live="polite">
          <span className="calendario-mes">{MESES[visto.mes]}</span>
          <span className="calendario-ano">{visto.ano}</span>
        </strong>
        <button type="button" onClick={() => mudarMes(1)} disabled={indice >= mesesMaximo} aria-label="Próximo mês">
          <Seta direcao="direita" />
        </button>
      </div>

      <div className="calendario-grade" role="grid" aria-label={`${MESES[visto.mes]} de ${visto.ano}`}>
        {SEMANA.map((s, i) => (
          <span key={s} className={i === 0 ? 'calendario-semana domingo' : 'calendario-semana'} title={SEMANA_NOME[i]} aria-hidden="true">
            {s}
          </span>
        ))}
        {celulas.map((n, i) => {
          if (n === null) return <span key={`v${i}`} className="calendario-vazio" />
          const d = paraDia(visto.ano, visto.mes, n)
          const nomeFeriado = feriado(d)
          // Cor do número: envio (verde) > lembrete (azul) > domingo ou feriado (vermelho)
          const cor = envios.has(d) ? 'verde' : comLembrete.has(d) ? 'azul' : i % 7 === 0 || nomeFeriado ? 'vermelho' : null
          const classe = ['calendario-dia', cor, d === dia && 'escolhido', d === hoje && 'hoje'].filter(Boolean).join(' ')
          const extras = [
            nomeFeriado && `feriado: ${nomeFeriado}`,
            envios.has(d) && 'envio automático',
            comLembrete.has(d) && 'com lembrete',
          ].filter(Boolean)
          return (
            <button
              key={d}
              type="button"
              className={classe}
              disabled={d < hoje}
              aria-pressed={d === dia}
              title={nomeFeriado ? `Feriado: ${nomeFeriado}` : undefined}
              aria-label={`${n} de ${MESES[visto.mes]}${extras.length ? `, ${extras.join(', ')}` : ''}`}
              onClick={() => setDiaAberto(d)}
            >
              {n}
            </button>
          )
        })}
      </div>

      {/* Quadro pautado (como o "Lembrete" da folhinha): feriados, lembretes e envios do mês */}
      <div className="calendario-feriados">
        <span className="calendario-feriados-titulo">Lembretes</span>
        <ul aria-label="Lembretes do mês">
          {Array.from({ length: Math.max(LINHAS_QUADRO, linhas.length) }, (_, i) => {
            const l = linhas[i]
            if (!l) return <li key={`v${i}`} aria-hidden="true" />
            const dias = l.dias.map(dois).join(', ')
            return (
              <li key={`${l.tipo}${i}`} className={l.tipo} title={`${dias} – ${l.texto}`}>
                <span className="calendario-linha-texto">
                  <strong>{dias}</strong> – {l.texto}
                </span>
                {l.tipo === 'lembrete' && (
                  <button
                    type="button"
                    className="calendario-linha-remover"
                    onClick={() => removerLembrete(l.indice)}
                    aria-label={`Remover o lembrete do dia ${dias}: ${l.texto}`}
                    title="Remover lembrete"
                  >
                    ×
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      {erro && (
        <span id={`${id}-erro`} className="ficha-erro">
          {erro}
        </span>
      )}

      {/* Janela do dia: enviar a mensagem automática ou adicionar um lembrete. Esc, × ou clicar fora fecham */}
      <dialog
        ref={janelaDia}
        className="janela-envios janela-dia tema-clientes"
        aria-labelledby={`${id}-janela-dia`}
        onCancel={(e) => {
          e.preventDefault()
          setDiaAberto(null)
        }}
        onClick={(e) => e.target === janelaDia.current && setDiaAberto(null)}
      >
        <header className="janela-envios-topo">
          <div>
            <h2 id={`${id}-janela-dia`}>{diaAberto ? diaPorExtenso(diaAberto) : ''}</h2>
            <p>{feriadoDoDia ? `Feriado: ${feriadoDoDia}` : 'O que você quer marcar neste dia?'}</p>
          </div>
          <button type="button" className="janela-envios-fechar" onClick={() => setDiaAberto(null)} aria-label="Fechar">
            ×
          </button>
        </header>
        <div className="janela-envios-corpo">
          <div className="janela-foto-opcoes">
            <button
              type="button"
              className="janela-foto-opcao janela-dia-envio"
              disabled={diaAberto === dia}
              onClick={() => {
                onEscolher(diaAberto!)
                setDiaAberto(null)
              }}
            >
              <img src="/imgs/whatsapp.png" alt="" aria-hidden="true" width={44} height={44} />
              <strong>Enviar mensagem automática</strong>
              <span>{diaAberto === dia ? 'Este já é o dia do envio' : 'A mensagem do WhatsApp sai neste dia'}</span>
            </button>
            <button type="button" className="janela-foto-opcao janela-dia-lembrete" onClick={abrirLembrete}>
              <IconeSino />
              <strong>Adicionar lembrete</strong>
              <span>Anotar algo para lembrar neste dia</span>
            </button>
          </div>

          {lembretesDoDia.length > 0 && (
            <ul className="janela-dia-lembretes" aria-label="Lembretes deste dia">
              {lembretesDoDia.map((l) => (
                <li key={l.i}>
                  <IconeSino tamanho={20} />
                  <span>{l.texto}</span>
                  <button type="button" onClick={() => removerLembrete(l.i)} aria-label={`Remover o lembrete: ${l.texto}`} title="Remover lembrete">
                    <IconeLixeira tamanho={20} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </dialog>

      {/* Janela para digitar o lembrete */}
      <dialog
        ref={janelaTexto}
        className="janela-envios janela-lembrete tema-clientes"
        aria-labelledby={`${id}-janela-lembrete`}
        onCancel={(e) => {
          e.preventDefault()
          setEscrevendo(null)
        }}
        onClick={(e) => e.target === janelaTexto.current && setEscrevendo(null)}
      >
        <header className="janela-envios-topo">
          <div>
            <h2 id={`${id}-janela-lembrete`}>Novo lembrete</h2>
            <p>{escrevendo ? diaPorExtenso(escrevendo) : ''}</p>
          </div>
          <button type="button" className="janela-envios-fechar" onClick={() => setEscrevendo(null)} aria-label="Fechar">
            ×
          </button>
        </header>
        <div className="janela-envios-corpo">
          <label className="janela-lembrete-campo">
            <span>O que lembrar neste dia?</span>
            <textarea
              ref={campoTexto}
              value={texto}
              maxLength={LEMBRETE_MAXIMO}
              rows={5}
              placeholder="Ex.: Ligar para confirmar a troca do filtro"
              onChange={(e) => setTexto(e.target.value)}
            />
          </label>
          <p className="janela-lembrete-contagem">
            {texto.length}/{LEMBRETE_MAXIMO}
          </p>
          <div className="janela-lembrete-botoes">
            <button type="button" className="pagina-botao" onClick={salvarLembrete} disabled={!texto.trim()}>
              <IconeSino tamanho={20} />
              Salvar lembrete
            </button>
            <button type="button" className="pagina-botao neutro" onClick={() => setEscrevendo(null)}>
              Cancelar
            </button>
          </div>
        </div>
      </dialog>
    </div>
  )
}
