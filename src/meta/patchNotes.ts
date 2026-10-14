// In-game patch notes. Newest first. Bump package.json version with each entry.
export interface PatchNote { version: string; date: string; title: string; items: string[] }

export const PATCH_NOTES: PatchNote[] = [
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
