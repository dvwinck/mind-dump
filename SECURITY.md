# Politica de seguranca

## Versoes suportadas

Apenas a versao publicada a partir do branch `main` recebe correcoes de seguranca.

## Como reportar uma vulnerabilidade

**Nao abra uma issue publica.** Use o relato privado do GitHub:

1. Acesse a aba **Security** do repositorio.
2. Clique em **Report a vulnerability**.
3. Descreva o problema, os passos para reproduzir e o impacto esperado.

O primeiro retorno costuma acontecer em ate 7 dias. Depois da correcao, o relato pode ser divulgado com credito a quem encontrou.

## Escopo

O Mind Dump e 100% local: as notas ficam no `localStorage` do navegador e nenhum dado e enviado a servidores. Sao de interesse especial:

- XSS na renderizacao de notas ou na importacao de JSON;
- perda ou corrupcao de dados em importacao, exportacao ou atualizacao do service worker;
- cache do service worker servindo conteudo adulterado.

## Dependencias

As dependencias de desenvolvimento sao monitoradas pelo Dependabot e o codigo pelo CodeQL. O Bootstrap em `vendor/bootstrap/` e uma copia local e precisa ser atualizado manualmente.
