# Alyrio AI com Groq

A extensão 1.9 usa **Groq** como provedor padrão. Pedidos de texto usam `openai/gpt-oss-120b`. Quando o contexto contém imagens, o serviço seleciona `qwen/qwen3.8-27b` automaticamente. As respostas ficam no painel para revisão e cópia.

## Usar no Windows

A chave foi salva em `ai-service/.groq-key.dpapi`, criptografada para sua conta do Windows. Ela não aparece nos scripts da extensão nem nos relatórios. O serviço foi iniciado em segundo plano nesta configuração.

1. Recarregue a extensão em `brave://extensions` e atualize a página do Withub.
2. Abra **Alyrio AI** e clique em **Verificar conexão**. “Serviço pronto” indica que o serviço local está acessível e tem uma chave carregada.
3. Escreva seu pedido ou cole o texto que deseja revisar. Clique em **Gerar resposta**, revise a sugestão e use **Copiar resposta**.

Depois de reiniciar o computador, abra **Iniciar-IA.cmd** e mantenha a janela aberta. A chave salva será reutilizada. **Parar-IA.cmd** encerra somente o serviço da IA desta pasta. O Node.js já está instalado e não são necessários outros pacotes.

Para trocar a chave, encerre o serviço e execute no PowerShell:

```powershell
.\Iniciar-IA.cmd -AlterarChave
```

O iniciador pede a chave com texto oculto e usa a criptografia DPAPI do Windows. Em outro computador, instale Node.js LTS e configure a chave novamente.

## Funcionalidades

- **Humanizar**, **Resumir**, **Explicar tema técnico** e **Revisar registro** trabalham sobre o texto digitado ou a imagem anexada.
- O botão de histórico carrega o texto no campo para revisão. A API só é consultada ao solicitar a geração. A leitura depende dos seletores compatíveis com o layout do Withub.
- PNG, JPEG e WebP de até 4 MB são aceitos. O contexto usa até 20 mensagens recentes e as três imagens mais recentes. Cada mensagem pode ter até 12 mil caracteres, com limite de 60 mil no contexto total. Os limites de tokens da conta Groq também se aplicam; se houver erro de limite, reduza o histórico ou abra uma nova conversa.
- Uma consulta por vez evita solicitações duplicadas. **Tentar novamente** preserva a pergunta e a imagem. **Nova conversa** limpa o contexto e cancela a solicitação pendente; cancelamento após o processamento começar pode ainda consumir uso da API.
- A IA não envia mensagens, não preenche o campo de envio do cliente e não executa procedimentos no provedor.

Os textos e imagens incluídos em uma consulta são enviados ao Groq quando você gera a resposta. O serviço não grava conversas, respostas ou chaves em logs. O histórico do painel fica em memória e é perdido ao recarregar. A retenção pelo provedor segue as políticas da conta Groq. Responses é usado sem o campo `store`, que não é suportado pelo Groq.

## Serviço local

O serviço escuta apenas em `127.0.0.1:4318` e aceita solicitações de extensões. Para restringi-lo à sua extensão, configure `AUTO_PREENCHER_EXTENSION_ID` com o ID exibido em `brave://extensions`. Por padrão, outras extensões instaladas com acesso à rede local também podem usar o serviço.

Variáveis opcionais: `GROQ_API_KEY`, `GROQ_MODEL` e `GROQ_VISION_MODEL`. `npm run ai` inicia diretamente com a chave no ambiente. A opção `-Provedor OpenAI` mantém a integração anterior disponível quando solicitada explicitamente; não há troca automática de provedor.

## Validação

O teste real aceitou a chave, listou os dois modelos e retornou HTTP 200 para o GPT-OSS 120B, com resposta em aproximadamente 414 ms naquele pedido fictício. Essa medição pontual não garante desempenho. O relatório `artifacts/groq-connection.json` contém apenas status e metadados, sem chave ou dados de clientes.

A consulta de texto também respondeu pelo serviço completo da extensão. O teste com o ícone da extensão como imagem foi bloqueado por saldo/limite de uso do modelo Qwen. A função de imagens está implementada, mas depende de liberar esse modelo na conta Groq. O painel exibe o motivo específico sem trocar automaticamente de provedor.

`npm run test:ai` verifica provedor, modelos de texto/imagem, campos da API, histórico, atalhos, erros, cancelamento, repetição e ausência de ações nos chats. `npm run test:ai:windows` verifica entrada oculta, criptografia, reutilização e troca das chaves com dados fictícios. Esses testes não chamam APIs externas.

Para verificar a conta manualmente, use `.\Iniciar-IA.cmd -VerificarConta`. Com o serviço aberto, `node tools/check-ai-connection.cjs` testa a integração completa; acrescente `--image` para usar o ícone da extensão como imagem fictícia. Essas verificações consomem uso da API. A revisão visual no navegador instalado não foi realizada.

Referências: [Groq Responses API](https://console.groq.com/docs/responses-api), [modelos](https://console.groq.com/docs/models), [imagens e visão](https://console.groq.com/docs/vision).
