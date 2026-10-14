// In-game patch notes. Newest first. Bump package.json version with each entry.
export interface PatchNote { version: string; date: string; title: string; items: string[] }

export const PATCH_NOTES: PatchNote[] = [
  {
    version: '1.0.2',
    date: '2026-10-14',
    title: 'Modo de teste: tudo desbloqueado',
    items: [
      '<b>Todos os itens desbloqueados</b> automaticamente: skins, penteados premium, golpes especiais, supers e passivas.',
      'Bónus de teste: 20 de cada poção, 3 de cada baú, 50 000 moedas e 5 000 gemas.',
    ],
  },
  {
    version: '1.0.1',
    date: '2026-10-14',
    title: 'Ecrã estável e mais leve',
    items: [
      '<b>Corrigido o ecrã a piscar</b>: a resolução adaptativa já não oscila nem apaga frames ao ajustar-se.',
      'Flashes de ecrã dos Super Ataques muito mais suaves; menos cortes bruscos de câmara; flashes do público mais discretos.',
      'Raios de energia redesenhados (feixes suaves em vez de colunas brancas).',
      '<b>Personagens até 3x mais leves</b> de desenhar: as peças de cada lutador são agora fundidas por material.',
      'Novo campo de <b>Código promocional</b> nas Definições.',
      'Corrigido o Irish Whip (atirar às cordas) que por vezes não lançava o adversário.',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-10-14',
    title: 'Abertura do Ringue!',
    items: [
      '<b>Lutas automáticas em 3D</b>: boxe, wrestling e super poderes num ringue com público ao vivo, árbitro e cordas.',
      '<b>Mais de 40 golpes</b>: jabs, ganchos, suplexes, DDT, powerbomb, spear, dropkick, saltos do poste, pins com contagem até 3 e kick-outs aos 2.9.',
      '<b>Tag Team 2v2</b>: o parceiro espera no avental, entra com HOT TAG, salva pins e dá golpes ilegais.',
      '<b>10 Golpes Especiais e 6 Super Ataques</b> cinematográficos: Meteoro, Dragão Ascendente, Supernova e mais.',
      '<b>Criador de lutador</b>: pele, altura, físico, olhos, sobrancelhas, boca, barba, penteados e cores.',
      '<b>7 raridades</b>: Comum, Incomum, Raro, Épico, Lendário, Mítico e Cósmico — com números de série colecionáveis.',
      '<b>Baús animados</b> que caem no centro do ringue: Madeira, Prata, Ouro, Obsidiana e Cósmico.',
      '<b>10 atributos</b> (Força, Técnica, Velocidade, Esquiva, Defesa, Vitalidade, Fôlego, Crítico, Carisma, Resiliência) e caminho de níveis com recompensas.',
      '<b>Missões diárias e semanais</b>, prémio diário de login e <b>Desafios Lendários</b> com chefes e skins exclusivas.',
      '<b>Loja</b> com destaques diários, consumíveis, baús e gemas. <b>Trocas</b> entre jogadores através de códigos.',
      'PWA: instala no telemóvel ou PC e joga offline.',
    ],
  },
];

export const CURRENT_VERSION = PATCH_NOTES[0].version;
