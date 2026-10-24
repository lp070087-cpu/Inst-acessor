import { processLaunchEmails } from "./email-worker";

/**
 * Envio imediato (após a resposta) da confirmação/boas-vindas recém-criadas.
 * Usa o mesmo worker do cron, então claim + idempotência continuam valendo;
 * desligado sem LAUNCH_EMAIL_WORKER_ENABLED e silencioso em falhas (o cron
 * diário reprocessa o que ficar HELD).
 */
export async function triggerLaunchEmails(): Promise<void> {
  if (process.env.LAUNCH_EMAIL_WORKER_ENABLED !== "true") return;
  try {
    await processLaunchEmails(5);
  } catch {
    console.error("[launch-emails] envio imediato falhou; o cron tentará novamente");
  }
}
