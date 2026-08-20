import { ProxyAgent, setGlobalDispatcher } from "undici";

let applied = false;

export function applyEnvProxy() {
  if (applied) return;
  const proxy =
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY ||
    process.env.https_proxy ||
    process.env.http_proxy;
  if (!proxy) return;
  setGlobalDispatcher(new ProxyAgent(proxy));
  applied = true;
}

applyEnvProxy();
