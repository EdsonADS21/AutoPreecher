// Revision of the user's 2026-09-08 export. Audio and custom metadata are preserved.
const EXPANDER_REVISIONS_V1 = [
  {
    "shortcut": "#age",
    "originalLabel": "Agendamento confirmado",
    "originalBody": "Sua visita técnica foi agendada com sucesso! 😊\n📅 Dia: {{DATA}}\n🕒 Turno: {{TURNO}}\nPedimos, por gentileza, que haja uma pessoa maior de 18 anos no local para acompanhar o atendimento.\nCaso surja disponibilidade para antecipar o atendimento, nosso setor de agendamento entrará em contato para verificar a possibilidade de realizar a visita em uma data mais próxima.",
    "label": "Agendamento confirmado",
    "body": "Sua visita técnica está agendada! 😊\n\n📅 Data: {{DATA}}\n🕒 Turno: {{TURNO}}\n\nPor gentileza, garanta que uma pessoa maior de 18 anos esteja no local para acompanhar o atendimento.\n\nSe houver disponibilidade para antecipar a visita, nossa equipe de agendamento entrará em contato para verificar uma nova data com você."
  },
  {
    "shortcut": "#ini",
    "originalLabel": "Inicio de Conversa",
    "originalBody": "{{HORARIO}}, Tudo bem ? Meu nome é Edson, sou do Suporte técnico.\nComo posso lhe ajudar ? ",
    "label": "Início da conversa",
    "body": "{{HORARIO}}! Tudo bem? Meu nome é Edson e faço parte da equipe de suporte técnico.\n\nComo posso ajudar você hoje?"
  },
  {
    "shortcut": "#des",
    "originalLabel": "Desconectado - Inicio",
    "originalBody": "{{HORARIO}}, Tudo bem ? Meu nome é Edson, sou do Suporte técnico.\nVerifiquei que você informa estar desconectado, me confirma se no seu roteador esta apresentando um LED vermelho ?",
    "label": "Desconexão — início",
    "body": "{{HORARIO}}! Tudo bem? Meu nome é Edson e faço parte da equipe de suporte técnico.\n\nVi que você está sem conexão. Para começarmos a verificar, pode me confirmar se há alguma luz vermelha acesa no seu roteador?"
  },
  {
    "shortcut": "#len",
    "originalLabel": "Lentidão- Inicio",
    "originalBody": "{{HORARIO}}, Tudo bem ? Meu nome é Edson, sou do Suporte técnico.\nVerifiquei que você informa estar com lentidão na sua rede, essa lentidão ocorre em todos os dispositivos (Celulares, Notebooks, Televisões ...) da sua residência ou em algum dispositivo especifico ? ",
    "label": "Lentidão — início",
    "body": "{{HORARIO}}! Tudo bem? Meu nome é Edson e faço parte da equipe de suporte técnico.\n\nVi que você está percebendo lentidão na conexão. Isso acontece em todos os dispositivos da sua casa, como celulares, computadores e TVs, ou apenas em um aparelho específico?"
  },
  {
    "shortcut": "#um",
    "originalLabel": "Espera",
    "originalBody": "Um momento, vou verificar para você!",
    "label": "Aguarde um momento",
    "body": "Por gentileza, aguarde um momento enquanto verifico as informações para você."
  },
  {
    "shortcut": "#con",
    "originalLabel": "Continuidade",
    "originalBody": "{{HORARIO}}, Tudo bem ? Meu nome é Edson, sou do Suporte técnico, darei continuidade ao seu agendamento!",
    "label": "Continuidade do agendamento",
    "body": "{{HORARIO}}! Tudo bem? Meu nome é Edson e faço parte da equipe de suporte técnico.\n\nVou dar continuidade ao seu agendamento."
  },
  {
    "shortcut": "#inf",
    "originalLabel": "Informando Agendamento",
    "originalBody": "Verifiquei que foi realizado o agendamento para você no dia {{DATA}}, na parte da {{TURNO}}. Estaria ciente desse agendamento ?",
    "label": "Confirmação do agendamento",
    "body": "Verifiquei que sua visita técnica está agendada para {{DATA}}, no turno da {{TURNO}}.\n\nVocê já estava ciente desse agendamento?"
  },
  {
    "shortcut": "#vis",
    "originalLabel": "Visita tecnica - Informativo",
    "originalBody": "Verifiquei que no seu caso seria um problema físico na sua rede, nesse caso vamos estar realizando um agendamento de visita técnica para você. ",
    "label": "Visita técnica — orientação",
    "body": "Pelas informações verificadas até aqui, o problema parece estar relacionado à parte física da sua conexão.\n\nVamos agendar uma visita técnica para que a equipe confira a situação no local."
  },
  {
    "shortcut": "#ness",
    "originalLabel": "Dados Agendamento",
    "originalBody": "Pra gente seguir com o agendamento, você pode me passar uma informação, por favor? 💬\n\n📍 Localização (pode ser o link do Google Maps):\n\nAssim consigo agilizar tudo certinho pra você! 😉",
    "label": "Localização para o agendamento",
    "body": "Para seguirmos com o agendamento, pode me enviar a localização do atendimento, por gentileza? 📍\n\nVocê pode compartilhar o link do Google Maps. Essa informação ajuda nossa equipe a localizar o endereço e organizar a visita."
  },
  {
    "shortcut": "#boa",
    "originalLabel": "Finalização e Avaliação",
    "originalBody": "Agradeço imensamente pelo seu contato e por todo o carinho e paciência durante o nosso atendimento! Desejo a você uma {{EXCELENTE}}. 😊✨\n\nGostaria de pedir um favorzinho muito especial, de coração: assim que encerramos esta conversa, vai aparecer uma rápida pesquisa de satisfação na sua tela. Leva menos de 30 segundinhos, mas para mim faz toda a diferença do mundo!\n\nA sua avaliação positiva com 3 estrelas (ou nota máxima) é fundamental para o meu trabalho e reflete todo o esforço que dediquei para resolver a sua solicitação com o melhor cuidado possível. Por favor, não deixe de avaliar, conto de verdade com a sua força! 💙\n\nProtocolo de atendimento: {{PROTOCOLO}}\n\nMuito obrigado pela parceria, foi um enorme prazer te atender. {{DESPEDIDA}} 🌟",
    "label": "Encerramento e avaliação",
    "body": "Obrigado pelo contato e pela atenção durante o atendimento! Desejo a você uma {{EXCELENTE}}. 😊\n\nApós encerrarmos a conversa, aparecerá uma breve pesquisa de satisfação. Ela leva cerca de 30 segundos, e sua opinião é muito importante para melhorarmos nosso atendimento.\n\nSe ficou satisfeito com o suporte, agradeço sua avaliação com 3 estrelas (nota máxima). 💙\n\nProtocolo de atendimento: {{PROTOCOLO}}\n\nFoi um prazer atender você. {{DESPEDIDA}}"
  },
  {
    "shortcut": "#fiz",
    "originalLabel": "Procedimentos",
    "originalBody": "Realizei algumas configurações no seu equipamento. Durante esse processo, é possível que ele desligue por cerca de três minutinhos e, em seguida, ligue novamente automaticamente. Assim que ele reiniciar, por gentileza, verifique se houve alguma melhora na sua conexão e me informe, por favor.",
    "label": "Configurações e teste da conexão",
    "body": "Realizei alguns ajustes nas configurações do seu equipamento. Durante esse processo, ele pode ficar desligado por cerca de três minutos e reiniciar automaticamente.\n\nAssim que o equipamento voltar a funcionar, por gentileza, teste a conexão e me informe se percebeu alguma melhora."
  },
  {
    "shortcut": "#pro",
    "originalLabel": "Procedimentos- Audio",
    "originalBody": "",
    "label": "Procedimentos — áudio",
    "body": ""
  },
  {
    "shortcut": "#pag",
    "originalLabel": "Transferência de Setor",
    "originalBody": "Nesse caso seria diretamente com o setor Financeiro, irei transferir seu atendimento para que possam atender sua solicitação. Desde já, agradeço pelo contato, espero que você tenha um ótimo dia e excelente semana.",
    "label": "Transferência para o financeiro",
    "body": "Sua solicitação precisa ser tratada pela equipe do financeiro. Vou transferir o atendimento para que o setor possa ajudar você.\n\nObrigado pelo contato! Desejo a você um ótimo dia e uma excelente semana."
  },
  {
    "shortcut": "#for",
    "originalLabel": "Fora isso",
    "originalBody": "Fora isso, posso lhe ajudar em algo mais ?",
    "label": "Oferecer mais ajuda",
    "body": "Além disso, posso ajudar você com mais alguma coisa?"
  },
  {
    "shortcut": "#tv",
    "originalLabel": "Tv BOX",
    "originalBody": "Identificamos que esse aparelho não é homologado pela Anatel. Dispositivos sem essa certificação costumam apresentar falhas de fábrica, como desconexões frequentes, travamentos e lentidão para carregar vídeos.\n\nMuitas vezes o sinal da sua internet está funcionando perfeitamente nos celulares e computadores, mas o TV Box acaba travando por uma limitação do próprio aparelho ou dos servidores dele.",
    "label": "TV Box — orientação",
    "body": "Aparelhos de TV Box sem homologação da Anatel podem apresentar desconexões, travamentos e lentidão ao carregar vídeos.\n\nQuando a internet funciona normalmente nos celulares e computadores, mas o problema ocorre apenas no TV Box, a causa pode estar no próprio aparelho ou nos servidores do serviço de vídeo. Isso não significa, por si só, uma falha na conexão de internet."
  }
];

function reviseExpanderTags(tags) {
  let changed = 0;
  const normalize = text => String(text || '').replace(/\r\n/g, '\n').trim();
  const revised = tags.map(tag => {
    const revision = EXPANDER_REVISIONS_V1.find(item => item.shortcut === tag.shortcut);
    if (!revision || normalize(tag.body) !== normalize(revision.originalBody)) return tag;
    const label = tag.label === revision.originalLabel ? revision.label : tag.label;
    if (tag.body === revision.body && tag.label === label) return tag;
    changed++;
    return { ...tag, label, body: revision.body };
  });
  return { tags: revised, changed };
}
