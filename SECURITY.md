# Política de segurança

## Versões suportadas

Apenas a versão publicada a partir do branch `main` recebe correções de segurança.

## Como reportar uma vulnerabilidade

**Não abra uma issue pública.** Use o relato privado do GitHub:

1. Acesse a aba **Security** do repositório.
2. Clique em **Report a vulnerability**.
3. Descreva o problema, os passos para reproduzir e o impacto esperado.

O primeiro retorno costuma acontecer em até 7 dias. Depois da correção, o relato pode ser divulgado com crédito a quem encontrou.

## Escopo

O Mind Dump é 100% local: as notas ficam no `localStorage` do navegador e nenhum dado é enviado a servidores. São de interesse especial:

- XSS na renderização de notas ou na importação de JSON;
- perda ou corrupção de dados em importação, exportação ou atualização do service worker;
- cache do service worker servindo conteúdo adulterado.

## Dependências

As dependências de desenvolvimento são monitoradas pelo Dependabot e o código pelo CodeQL. O Bootstrap em `vendor/bootstrap/` é uma cópia local e precisa ser atualizado manualmente.
