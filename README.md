# Ringue de Lendas

Jogo de luta 3D **automático** (auto-battler) de boxe + wrestling com toques de fantasia. Cria o teu lutador, vê-o lutar sozinho num ringue com público, árbitro e cordas, e coleciona skins, penteados e habilidades de 7 raridades. PWA instalável, feito para correr bem em telemóveis.

## Stack

- **Vite + TypeScript + Three.js** (sem framework de UI: DOM direto, muito leve).
- Sem assets externos: personagens, arena, efeitos, ícones e **som** são todos procedurais.
- PWA com service worker gerado no build (`vite.config.ts`) → funciona offline.
- Deploy: **Vercel** (`vercel.json` já configurado: `npm run build` → `dist`).

```bash
npm install
npm run dev      # desenvolvimento
npm run build    # typecheck + build de produção
npm run icons    # regenera os ícones PWA (precisa de Playwright global)
```

## Estrutura

| Pasta | O quê |
|---|---|
| `src/engine/` | Renderer + resolução adaptativa (`gfx.ts`), arena com público instanciado num só draw call (`arena.ts`), partículas/ondas/raios (`fx.ts`), câmara-realizador estilo transmissão TV (`director.ts`), áudio sintetizado (`audio.ts`). |
| `src/char/` | Rig cartoon procedural (`rig.ts`), poses como `Float32Array` (`pose.ts`), animador com base procedural + clips com crossfade (`animator.ts`). |
| `src/fight/` | Biblioteca de golpes com keyframes e agarrões emparelhados (`moves.ts`), estado do lutador (`fighter.ts`), IA + regras do combate, pins com contagem do árbitro, tag team, supers cinematográficos (`match.ts`). |
| `src/meta/` | Dados do jogo (`data.ts`: raridades, atributos, itens, baús, missões, desafios), save/economia (`save.ts`), recompensas (`rewards.ts`), geração de adversários (`opponents.ts`), notas de versão (`patchNotes.ts`). |
| `src/ui/` | Shell da app, ecrãs (criador, início, lutador, coleção, loja, baús, missões, trocas, novidades, definições, combate, resultados). |
| `src/stages.ts` | Cenas 3D por ecrã: vitrine do lutador, abertura de baús no centro do ringue. |

## Design (resumo)

- **Câmaras**: vista alta de transmissão por defeito + cortes dinâmicos (vista de cima, canto, baixo junto ao ringue, órbita, close-ups em especiais/supers, câmara lenta em K.O.).
- **Combate 1v1**: socos, ganchos, uppercuts, pontapés, chops, suplex, DDT, powerbomb, body slam, Irish whip às cordas + clothesline/spear/dropkick, saltos do poste, pins com kick-outs dramáticos aos 2.9, esquivas, bloqueios, contra-ataques, críticos.
- **Tag Team 2v2**: parceiro no avental, tag na mão no canto, HOT TAG, salvamento de pins, golpes ilegais do avental.
- **Progressão**: 10 atributos (Força, Técnica, Velocidade, Esquiva, Defesa, Vitalidade, Fôlego, Crítico, Carisma, Resiliência), +3 pontos e +vida por nível, caminho de níveis com recompensas.
- **Colecionismo**: 7 raridades (Comum → Cósmico) com números de série limitados, baús animados, missões diárias/semanais, Desafios Lendários com chefes, códigos de troca entre jogadores (base para um futuro mercado online).
- **Loja**: destaques diários em moedas/gemas; pacotes de gemas com preço real preparados (checkout ainda por ligar).

Ao adicionar funcionalidades: sobe a versão em `package.json` e acrescenta uma entrada em `src/meta/patchNotes.ts` (aparece no ecrã "Novidades").
