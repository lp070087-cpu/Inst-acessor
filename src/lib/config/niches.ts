/**
 * BIBLIOTECA DE NICHOS — roda #291
 * ================================
 * Lista central (pt-BR) de nichos usada pelo combobox pesquisável do /perfil.
 *
 * Regras desta camada:
 * - É a ÚNICA fonte de opções do campo "Nicho" do Perfil. Nada em paralelo.
 * - O valor salvo em UserProfile.niche continua sendo a MESMA string simples
 *   (rótulo escolhido OU texto livre quando o usuário escolhe "Outro").
 *   A IA já lê esse campo direto em src/lib/ai/context.ts — sem sistema duplo.
 * - Nenhum rótulo passa de 80 caracteres (limite do validator do /api/perfil).
 * - OUTRO_NICHO é um sentinela: no Perfil ele abre um campo de texto livre e
 *   NUNCA é persistido como "Outro" — salva-se o que o usuário digitar.
 */

export interface NicheOption {
  /** Rótulo exibido no combobox E valor salvo quando o item é selecionado. */
  label: string;
  /** Grupo/categoria usado para a exibição agrupada da lista. */
  group: string;
}

/** Sentinela de "nenhum da lista" — abre o campo de texto livre. */
export const OUTRO_NICHO = "Outro";

export const NICHE_OPTIONS: NicheOption[] = [
  // Estilo de vida -------------------------------------------------------
  { label: "Moda", group: "Estilo de vida" },
  { label: "Moda feminina", group: "Estilo de vida" },
  { label: "Moda masculina", group: "Estilo de vida" },
  { label: "Moda plus size", group: "Estilo de vida" },
  { label: "Moda sustentável", group: "Estilo de vida" },
  { label: "Moda streetwear", group: "Estilo de vida" },
  { label: "Moda fitness", group: "Estilo de vida" },
  { label: "Beleza", group: "Estilo de vida" },
  { label: "Maquiagem", group: "Estilo de vida" },
  { label: "Skincare", group: "Estilo de vida" },
  { label: "Cabelos", group: "Estilo de vida" },
  { label: "Barbearia", group: "Estilo de vida" },
  { label: "Unhas", group: "Estilo de vida" },
  { label: "Perfumaria", group: "Estilo de vida" },
  { label: "Tatuagem", group: "Estilo de vida" },
  { label: "Piercing", group: "Estilo de vida" },
  { label: "Estilo pessoal", group: "Estilo de vida" },

  // Saúde e bem-estar ----------------------------------------------------
  { label: "Fitness", group: "Saúde e bem-estar" },
  { label: "Musculação", group: "Saúde e bem-estar" },
  { label: "Crossfit", group: "Saúde e bem-estar" },
  { label: "Funcional", group: "Saúde e bem-estar" },
  { label: "Corrida", group: "Saúde e bem-estar" },
  { label: "Ciclismo", group: "Saúde e bem-estar" },
  { label: "Yoga", group: "Saúde e bem-estar" },
  { label: "Pilates", group: "Saúde e bem-estar" },
  { label: "Dança", group: "Saúde e bem-estar" },
  { label: "Alongamento e mobilidade", group: "Saúde e bem-estar" },
  { label: "Nutrição", group: "Saúde e bem-estar" },
  { label: "Dieta e emagrecimento", group: "Saúde e bem-estar" },
  { label: "Saúde mental", group: "Saúde e bem-estar" },
  { label: "Meditação", group: "Saúde e bem-estar" },
  { label: "Bem-estar natural", group: "Saúde e bem-estar" },

  // Esportes --------------------------------------------------------------
  { label: "Futebol", group: "Esportes" },
  { label: "Futevôlei", group: "Esportes" },
  { label: "Futsal", group: "Esportes" },
  { label: "Vôlei", group: "Esportes" },
  { label: "Basquete", group: "Esportes" },
  { label: "Tênis", group: "Esportes" },
  { label: "Natação", group: "Esportes" },
  { label: "Esportes aquáticos", group: "Esportes" },
  { label: "Surfe", group: "Esportes" },
  { label: "Skate", group: "Esportes" },
  { label: "Escalada", group: "Esportes" },
  { label: "MMA", group: "Esportes" },
  { label: "Jiu-jitsu", group: "Esportes" },
  { label: "Muay Thai", group: "Esportes" },
  { label: "Boxe", group: "Esportes" },
  { label: "eSports e games", group: "Esportes" },

  // Comida e bebida -------------------------------------------------------
  { label: "Gastronomia", group: "Comida e bebida" },
  { label: "Culinária", group: "Comida e bebida" },
  { label: "Receitas fáceis", group: "Comida e bebida" },
  { label: "Confeitaria e doces", group: "Comida e bebida" },
  { label: "Panificação", group: "Comida e bebida" },
  { label: "Churrasco", group: "Comida e bebida" },
  { label: "Comida vegana", group: "Comida e bebida" },
  { label: "Comida fitness", group: "Comida e bebida" },
  { label: "Comida de rua", group: "Comida e bebida" },
  { label: "Drinks e coquetelaria", group: "Comida e bebida" },
  { label: "Café", group: "Comida e bebida" },
  { label: "Vinhos", group: "Comida e bebida" },
  { label: "Restaurantes e avaliações", group: "Comida e bebida" },

  // Viagens e lazer -------------------------------------------------------
  { label: "Viagens", group: "Viagens e lazer" },
  { label: "Turismo", group: "Viagens e lazer" },
  { label: "Roteiros de viagem", group: "Viagens e lazer" },
  { label: "Aventura e ecoturismo", group: "Viagens e lazer" },
  { label: "Hotelaria e hospedagem", group: "Viagens e lazer" },
  { label: "Férias em família", group: "Viagens e lazer" },
  { label: "Backpacker", group: "Viagens e lazer" },

  // Casa e decoração ------------------------------------------------------
  { label: "Decoração", group: "Casa e decoração" },
  { label: "DIY e artesanato", group: "Casa e decoração" },
  { label: "Organização e limpeza", group: "Casa e decoração" },
  { label: "Jardinagem", group: "Casa e decoração" },
  { label: "Arquitetura e interiores", group: "Casa e decoração" },
  { label: "Reforma e marcenaria", group: "Casa e decoração" },

  // Carreira e negócios ---------------------------------------------------
  { label: "Empreendedorismo", group: "Carreira e negócios" },
  { label: "Startups", group: "Carreira e negócios" },
  { label: "Negócios online", group: "Carreira e negócios" },
  { label: "Marketing digital", group: "Carreira e negócios" },
  { label: "Social media", group: "Carreira e negócios" },
  { label: "Vendas", group: "Carreira e negócios" },
  { label: "Vendas online", group: "Carreira e negócios" },
  { label: "Finanças pessoais", group: "Carreira e negócios" },
  { label: "Investimentos", group: "Carreira e negócios" },
  { label: "Carreira e empregos", group: "Carreira e negócios" },
  { label: "Produtividade", group: "Carreira e negócios" },
  { label: "Desenvolvimento pessoal", group: "Carreira e negócios" },
  { label: "Liderança", group: "Carreira e negócios" },
  { label: "Consultoria e serviços", group: "Carreira e negócios" },

  // Educação ---------------------------------------------------------------
  { label: "Educação", group: "Educação" },
  { label: "Ensino e pedagogia", group: "Educação" },
  { label: "Idiomas", group: "Educação" },
  { label: "Cursos online", group: "Educação" },
  { label: "Estudos e concursos", group: "Educação" },
  { label: "Educação financeira", group: "Educação" },

  // Tecnologia -------------------------------------------------------------
  { label: "Tecnologia", group: "Tecnologia" },
  { label: "Programação", group: "Tecnologia" },
  { label: "Inteligência artificial", group: "Tecnologia" },
  { label: "Desenvolvimento de software", group: "Tecnologia" },
  { label: "Design", group: "Tecnologia" },
  { label: "UX e UI", group: "Tecnologia" },
  { label: "Fotografia", group: "Tecnologia" },
  { label: "Vídeo e edição", group: "Tecnologia" },
  { label: "Gadgets e reviews", group: "Tecnologia" },
  { label: "Automação", group: "Tecnologia" },
  { label: "Cibersegurança", group: "Tecnologia" },
  { label: "Dados e análise", group: "Tecnologia" },

  // Entretenimento e cultura ----------------------------------------------
  { label: "Música", group: "Entretenimento e cultura" },
  { label: "Instrumentos musicais", group: "Entretenimento e cultura" },
  { label: "Canto", group: "Entretenimento e cultura" },
  { label: "Cinema e séries", group: "Entretenimento e cultura" },
  { label: "Livros e leitura", group: "Entretenimento e cultura" },
  { label: "Escrita", group: "Entretenimento e cultura" },
  { label: "Teatro", group: "Entretenimento e cultura" },
  { label: "Humor e comédia", group: "Entretenimento e cultura" },
  { label: "Artes plásticas", group: "Entretenimento e cultura" },
  { label: "Ilustração e desenho", group: "Entretenimento e cultura" },
  { label: "Cultura pop", group: "Entretenimento e cultura" },
  { label: "Animes e mangás", group: "Entretenimento e cultura" },
  { label: "Games", group: "Entretenimento e cultura" },

  // Pets -------------------------------------------------------------------
  { label: "Pets", group: "Pets" },
  { label: "Cachorros", group: "Pets" },
  { label: "Gatos", group: "Pets" },
  { label: "Pets exóticos", group: "Pets" },
  { label: "Adestramento e comportamento animal", group: "Pets" },
  { label: "Pet shop e banho e tosa", group: "Pets" },

  // Família e infantil ------------------------------------------------------
  { label: "Maternidade", group: "Família e infantil" },
  { label: "Paternidade", group: "Família e infantil" },
  { label: "Família", group: "Família e infantil" },
  { label: "Bebês", group: "Família e infantil" },
  { label: "Infantil e kids", group: "Família e infantil" },
  { label: "Escola e atividades infantis", group: "Família e infantil" },

  // Outro (sentinela — abre campo de texto livre) ---------------------------
  { label: OUTRO_NICHO, group: "Outros" },
];

/** Rótulo de exibição de um grupo da lista. */
export function nicheGroupLabel(group: string): string {
  return group;
}
