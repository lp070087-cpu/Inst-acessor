import { redirect } from "next/navigation";

// /lista-de-espera é um endereço fácil de divulgar; o formulário vive na landing.
export default function WaitlistShortcutPage() {
  redirect("/#lista-de-espera");
}
