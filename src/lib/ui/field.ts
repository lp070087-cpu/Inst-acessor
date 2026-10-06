/**
 * Classe canônica dos campos de formulário do app (input, select, textarea).
 *
 * Por que existe: o mesmo campo era reescrito à mão em cada tela com pequenas
 * divergências — raio 8px aqui, 10px ali, `bg-bg` numa e `bg-card` na outra,
 * `text-[13px]` numa e `text-[14px]` na vizinha. O usuário atravessava o app e
 * sentia a diferença sem saber apontar de onde vinha. Aqui há UMA fonte.
 *
 * Regras que a classe carrega:
 *  • raio 10px (o mesmo do botão `xs`), borda suave;
 *  • altura de toque confortável (`py-2.5` + `text-[14px]`);
 *  • foco visível na cor da marca (`ring-purple/30`);
 *  • `w-full`: o campo ocupa a coluna. Quem precisa de largura menor já
 *    envolve o campo em um container de largura fixa — não é papel daqui.
 *
 * O FUNDO é o único eixo variável, e por isso é PARÂMETRO — não um sufixo.
 *
 * Por que não basta concatenar `bg-bg` depois: as duas classes de fundo
 * ficariam no MESMO elemento e quem decide é a ordem em que o Tailwind emite,
 * não a ordem em que aparecem no atributo. No `tailwind.config.ts` o token `bg`
 * (cinza) é declarado ANTES do token `card` (branco), então `.bg-card` sai
 * depois de `.bg-bg` na folha e vence sempre. Um campo montado por concatenação
 * ficaria com `bg-bg` no código e BRANCO na tela — errado, e sem aviso nenhum.
 * Escolhendo o fundo na origem, só uma classe de fundo entra no elemento.
 */
const FIELD_SHELL =
  "w-full px-3.5 py-2.5 rounded-[10px] border border-border-soft text-[14px] text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-purple/30";

/** Fundos válidos para um campo. */
type Surface = "card" | "bg" | "surface";

const SURFACE: Record<Surface, string> = {
  /** Campo BRANCO — quando ele fica sobre uma superfície cinza. */
  card: "bg-card",
  /** Campo CINZA — quando ele fica sobre uma superfície branca (modal, cartão). */
  bg: "bg-bg",
  /** Campo cinza da própria paleta de superfície (somente leitura). */
  surface: "bg-surface",
};

interface FieldClassOptions {
  /** `card` (padrão) = campo branco; `bg` = campo cinza sobre superfície branca. */
  surface?: Surface;
  /** `<select>`: ponteiro no cursor. */
  select?: boolean;
  /** Somente leitura: fundo de superfície e texto mais fraco. */
  readonly?: boolean;
  /** Extras do chamador (ex.: `resize-none`). */
  className?: string;
}

/**
 * Monta a classe do campo. Use quando o campo NÃO é o caso padrão.
 * Para o caso padrão existem as constantes abaixo.
 */
export function fieldClass({
  surface = "card",
  select = false,
  readonly = false,
  className,
}: FieldClassOptions = {}): string {
  const parts = [
    FIELD_SHELL,
    // `readonly` tem precedência: o campo não é editável, então o fundo é
    // sempre o de superfície — mesmo que o chamador peça `card`.
    readonly ? SURFACE.surface : SURFACE[surface],
    readonly && "text-ink-soft",
    select && "cursor-pointer",
    className,
  ].filter(Boolean);

  return parts.join(" ");
}

/** Padrão: campo BRANCO sobre superfície cinza. */
export const FIELD_CLASS = fieldClass();

/** Padrão para `<select>`. */
export const SELECT_CLASS = fieldClass({ select: true });

/** Somente leitura: continua legível, mas deixa claro que não é editável. */
export const FIELD_CLASS_READONLY = fieldClass({ readonly: true });

/** Campo CINZA, para uso sobre superfície BRANCA (dentro de modal ou cartão). */
export const FIELD_CLASS_FILLED = fieldClass({ surface: "bg" });

/** Campo CINZA para `<select>`. */
export const SELECT_CLASS_FILLED = fieldClass({ surface: "bg", select: true });
