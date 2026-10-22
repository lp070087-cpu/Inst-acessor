// next-auth publica o provider como CommonJS com `exports.default`; no ESM do
// Node o import default recebe o objeto do módulo, enquanto o bundler do Next
// entrega a função. Este shim reproduz o comportamento do bundler nos testes.
import mod from "next-auth/providers/credentials";
export default typeof mod === "function" ? mod : mod.default;
