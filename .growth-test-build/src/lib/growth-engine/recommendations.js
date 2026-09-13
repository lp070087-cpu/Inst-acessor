"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRecommendations = buildRecommendations;
/**
 * RECOMENDAÇÕES ACIONÁVEIS — Fase 8 (Parte 6)
 * =============================================
 * Converte prioridades em recomendações concretas. Cada recomendação tem:
 *   oQue / porQue / evidencia / como / quando / resultadoEsperado /
 *   metrica / confianca / priorityLevel.
 *
 * REGRA: recomendações SEMPRE baseadas em dados reais do contexto. Nunca
 * "poste mais" genérico — a recomendação cita o valor real e o caminho.
 */
/** Slugs estáveis por sinal (usados para dedup de GrowthAction). */
function slugFor(signal, index) {
    return `${signal.toLowerCase().replace(/_/g, "-")}-${index + 1}`;
}
function platformLabel(p) {
    return p === "tiktok" ? "TikTok" : "Instagram";
}
/** Constrói uma recomendação a partir de uma prioridade e contexto. */
function buildRecommendation(ctx, priority) {
    const signal = priority.signalType;
    const platform = priority.platform ?? null;
    const pc = platform ? ctx[platform] : null;
    const evidence = priority.evidenceSummary;
    const base = {
        signalType: signal,
        platform,
        priorityLevel: priority.level,
        confianca: priority.confidence,
    };
    const oQue = priority.title;
    const metrica = "A definir com base no contexto";
    switch (signal) {
        case "LOW_POSTING_FREQUENCY": {
            const freq = pc?.frequency ?? null;
            return {
                ...base,
                slug: slugFor(signal, priority.level),
                oQue: `Aumentar a frequência de postagem em ${platformLabel(platform)} — de ${freq ?? "—"} para pelo menos 3 por semana`,
                porQue: "Frequência consistente é o principal motor de alcance e engajamento no início de crescimento.",
                evidencia: evidence,
                como: "Defina 3 dias fixos na semana. No calendário, agende um conteúdo por dia usando ideias salvas e copies aprovadas.",
                quando: "Comece já — agende os próximos 7 dias esta semana.",
                resultadoEsperado: "Base consistente para o algoritmo distribuir seu conteúdo e para a audiência criar hábito.",
                metrica: "Publicações por semana (conteúdos com status PUBLICADO/AGENDADO no calendário).",
                confianca: Math.round((priority.confidence + 0.1) * 100) / 100,
            };
        }
        case "ENGAGEMENT_DROP": {
            return {
                ...base,
                slug: slugFor(signal, priority.level),
                oQue: `Revisar os conteúdos recentes de ${platformLabel(platform)} que tiveram queda de engajamento`,
                porQue: "Queda de engajamento indica perda de conexão com a audiência — o algoritmo passa a entregar menos.",
                evidencia: evidence,
                como: "Abra Análise de Desempenho, compare os últimos 7 vs 7 anteriores e identifique o formato que caiu. Teste um gancho diferente nos próximos 3 posts.",
                quando: "Nos próximos 3 conteúdos.",
                resultadoEsperado: "Engajamento volta ao patamar anterior dentro de 14 dias.",
                metrica: "Engajamento médio por conteúdo (Instagram).",
            };
        }
        case "REACH_DROP": {
            return {
                ...base,
                slug: slugFor(signal, priority.level),
                oQue: `Recuperar o alcance no ${platformLabel(platform)} após queda de ${(pc?.reach ?? 0) > 0 ? "alcance" : "entregas"}`,
                porQue: "Alcance menor reduz o número de pessoas novas que veem seu conteúdo.",
                evidencia: evidence,
                como: "Publique no horário de maior atividade da audiência (veja os melhores dias no timeline) e priorize formatos com maior alcance histórico.",
                quando: "Nas próximas 2 semanas.",
                resultadoEsperado: "Alcance volta ao patamar médio anterior.",
                metrica: "Alcance por conteúdo (Instagram).",
            };
        }
        case "FOLLOWER_GROWTH_DROP": {
            return {
                ...base,
                slug: slugFor(signal, priority.level),
                oQue: `Estancar a perda de seguidores em ${platformLabel(platform)} (crescimento ${pc?.growth != null ? `${pc.growth.toFixed(1)}%` : "negativo"} no mês)`,
                porQue: "Crescimento negativo indica que o conteúdo atual não atrai novos seguidores.",
                evidencia: evidence,
                como: "Revise o perfil (bio, destaque, capa) e produza 2 conteúdos de 'prova social' (resultados, bastidores, método).",
                quando: "Na próxima semana.",
                resultadoEsperado: "Crescimento mensal volta a ser positivo em 30 dias.",
                metrica: "Crescimento mensal de seguidores.",
            };
        }
        case "HIGH_PERFORMING_CONTENT": {
            return {
                ...base,
                slug: slugFor(signal, priority.level),
                oQue: `Reproduzir o conteúdo de alto desempenho em ${platformLabel(platform)} (${pc?.bestContent?.[0]?.label ?? "melhor conteúdo"})`,
                porQue: "Conteúdo que já performou bem tende a performar novamente — é a evidência mais forte que você tem.",
                evidencia: evidence,
                como: "Analise o que o melhor conteúdo teve em comum (gancho, formato, tema) e produza uma sequência de 3 variações.",
                quando: "Nesta semana.",
                resultadoEsperado: "Novo conteúdo de alto desempenho.",
                metrica: "Alcance/engajamento do novo conteúdo.",
                confianca: Math.min(1, priority.confidence + 0.1),
            };
        }
        case "LOW_RETENTION": {
            return {
                ...base,
                slug: slugFor(signal, priority.level),
                oQue: `Melhorar a retenção dos conteúdos de ${platformLabel(platform)}`,
                porQue: "Baixa retenção reduz a distribuição — o algoritmo prioriza quem segura a atenção.",
                evidencia: evidence,
                como: "Encurte a introdução, use gancho nos primeiros 3 segundos e adicione legendas/CTA no meio do conteúdo.",
                quando: "Nos próximos 5 conteúdos.",
                resultadoEsperado: "Retenção maior e melhor distribuição.",
                metrica: "Retenção aproximada (engajamento/publicações).",
            };
        }
        case "INCONSISTENT_POSTING": {
            return {
                ...base,
                slug: slugFor(signal, priority.level),
                oQue: `Estabelecer uma rotina consistente de postagem em ${platformLabel(platform)}`,
                porQue: "Postagens irregulares confundem a audiência e o algoritmo.",
                evidencia: evidence,
                como: "Use o Calendário para planejar 2-3 semanas de conteúdo e o Preview Social para aprovar antes de agendar.",
                quando: "Planeje hoje, execute a partir de amanhã.",
                resultadoEsperado: "Frequência estável por 4 semanas.",
                metrica: "Intervalo entre publicações.",
            };
        }
        case "GOAL_ON_TRACK": {
            const goal = priority.objective ?? "meta";
            return {
                ...base,
                slug: slugFor(signal, priority.level),
                oQue: `Manter o ritmo da meta "${goal}" — está no caminho certo`,
                porQue: "Metas no caminho certo devem ser mantidas para não cair no risco no fim do prazo.",
                evidencia: evidence,
                como: "Continue com a frequência atual e monitore o progresso semanalmente no Rank.",
                quando: "Semanalmente.",
                resultadoEsperado: "Meta concluída dentro do prazo.",
                metrica: "Progresso da meta (%) no Rank.",
            };
        }
        case "GOAL_AT_RISK": {
            const goal = priority.objective ?? "meta";
            return {
                ...base,
                slug: slugFor(signal, priority.level),
                oQue: `Retomar a meta "${goal}" antes do prazo`,
                porQue: "Metas em risco precisam de ação imediata para não expirar.",
                evidencia: evidence,
                como: "Quebre a meta em 2-3 ações menores no plano de 7 dias e priorize o que move a métrica da meta.",
                quando: "Hoje.",
                resultadoEsperado: "Meta dentro do prazo.",
                metrica: "Progresso da meta (%) no Rank.",
            };
        }
        case "GOAL_ACHIEVED": {
            const goal = priority.objective ?? "meta";
            return {
                ...base,
                slug: slugFor(signal, priority.level),
                oQue: `Celebrar e revisar a meta "${goal}" atingida`,
                porQue: "Entender o que funcionou permite repetir.",
                evidencia: evidence,
                como: "Documente no Perfil de Inteligência o que contribuiu e defina a próxima meta no Rank.",
                quando: "Esta semana.",
                resultadoEsperado: "Próxima meta definida com base em evidência.",
                metrica: "Novas metas criadas.",
            };
        }
        case "EXPERIMENT_RUNNING": {
            return {
                ...base,
                slug: slugFor(signal, priority.level),
                oQue: `Acompanhar o experimento em andamento em ${platformLabel(platform)}`,
                porQue: "Um experimento sem acompanhamento não gera aprendizado — registre observações ao longo do teste.",
                evidencia: evidence,
                como: "Registre observações no experimento conforme novos dados chegarem e evite concluir antes da amostra mínima.",
                quando: "A cada sincronização de dados.",
                resultadoEsperado: "Experimento com dados suficientes para declarar vencedor/perdedor.",
                metrica: "Nº de observações do experimento.",
            };
        }
        case "EXPERIMENT_WINNER": {
            return {
                ...base,
                slug: slugFor(signal, priority.level),
                oQue: `Escalar o que o experimento vencedor provou em ${platformLabel(platform)}`,
                porQue: "Resultado confirmado por experimento é a evidência mais confiável.",
                evidencia: evidence,
                como: "Aplique a variação vencedora nos próximos conteúdos e registre como padrão.",
                quando: "A partir de agora.",
                resultadoEsperado: "Ganhos consistentes da variação vencedora.",
                metrica: "Métrica do experimento.",
            };
        }
        case "EXPERIMENT_LOSER": {
            return {
                ...base,
                slug: slugFor(signal, priority.level),
                oQue: `Aprender com o experimento que não venceu em ${platformLabel(platform)}`,
                porQue: "Um experimento 'perdedor' também ensina — saber o que não funciona evita repetir o erro.",
                evidencia: evidence,
                como: "Registre o aprendizado no Perfil de Inteligência e evite aplicar a variação testada nos próximos conteúdos.",
                quando: "Esta semana.",
                resultadoEsperado: "Conhecimento aplicado e variável descartada.",
                metrica: "Novos padrões registrados.",
            };
        }
        case "EXPERIMENT_INCONCLUSIVE": {
            return {
                ...base,
                slug: slugFor(signal, priority.level),
                oQue: `Replanejar o experimento inconclusivo`,
                porQue: "Sem dados suficientes, não é possível declarar vencedor — planeje melhor a amostra.",
                evidencia: evidence,
                como: "Aumente a amostra, controle melhor as variáveis e rode novamente por tempo suficiente.",
                quando: "Na próxima rodada de experimentos.",
                resultadoEsperado: "Experimento com dados suficientes.",
                metrica: "Nº de observações do experimento.",
            };
        }
        case "CONTENT_GAP": {
            return {
                ...base,
                slug: slugFor(signal, priority.level),
                oQue: `Preencher a lacuna de conteúdo dos próximos 7 dias em ${platformLabel(platform)}`,
                porQue: "Sem conteúdo planejado, a frequência consistente quebra.",
                evidencia: evidence,
                como: "Abra a Central de Ideias, selecione 3 ideias, gere copies e agende no calendário.",
                quando: "Hoje.",
                resultadoEsperado: "Próximos 7 dias com conteúdo agendado.",
                metrica: "Conteúdos agendados para os próximos 7 dias.",
            };
        }
        case "PROFILE_OPTIMIZATION_NEEDED": {
            return {
                ...base,
                slug: slugFor(signal, priority.level),
                oQue: "Otimizar o perfil (bio, destaques, capa) para conversão",
                porQue: "O perfil é a página de destino de todo conteúdo — sem otimização, seguidores não viram clientes.",
                evidencia: evidence,
                como: "Use o Gerador de Copy para reescrever a bio com objetivo claro, CTA e prova social.",
                quando: "Esta semana.",
                resultadoEsperado: "Perfil converte mais visitantes em seguidores/clientes.",
                metrica: "Conversão de visitas em seguidores (quando disponível).",
            };
        }
        case "NO_RECENT_DATA": {
            return {
                ...base,
                slug: slugFor(signal, priority.level),
                oQue: `Sincronizar os dados de ${platformLabel(platform)} para o motor de crescimento funcionar`,
                porQue: "Sem dados recentes, o Inst Acessor não consegue recomendar com precisão.",
                evidencia: evidence,
                como: "Clique em 'Sincronizar' na página da rede social ou aguarde o próximo sync automático.",
                quando: "Hoje.",
                resultadoEsperado: "Dados atualizados e recomendações precisas.",
                metrica: "Última sincronização.",
            };
        }
        case "NO_CONNECTED_ACCOUNT": {
            return {
                ...base,
                slug: slugFor(signal, priority.level),
                oQue: `Conectar ${platformLabel(platform)} para começar o acompanhamento`,
                porQue: "O motor de crescimento precisa de dados reais — nenhuma conta conectada significa nenhuma recomendação.",
                evidencia: evidence,
                como: "Vá em Redes Sociais e conecte sua conta profissional.",
                quando: "Hoje.",
                resultadoEsperado: "Primeira sincronização e início do diagnóstico.",
                metrica: "Conta conectada.",
            };
        }
        default:
            return null;
    }
}
/**
 * Gera as recomendações a partir das prioridades (máx. 3).
 * Recomendações dependem de evidência real — sem ela, retorna vazio.
 */
function buildRecommendations(ctx, priorities) {
    const out = [];
    for (const priority of priorities) {
        const rec = buildRecommendation(ctx, priority);
        if (rec)
            out.push(rec);
    }
    return out;
}
