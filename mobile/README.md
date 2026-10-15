# Presença+ · Aplicativo do aluno

Aplicativo Android (React Native + Expo + TypeScript). O aluno entra com a **matrícula e a senha**, lê o QR Code exibido pelo professor e o app envia a localização do aparelho para validar a presença. O app também mostra a frequência por turma e o histórico de presenças e faltas.

## Executar no celular

Para instalar o app de vez, sem o Expo Go, veja [Gerar o APK](#gerar-o-apk-instalar-sem-o-expo-go).

Pré-requisitos: o backend rodando (`cd backend && npm run dev`), o celular e o computador **na mesma rede Wi-Fi** e o app **Expo Go** instalado no celular (Play Store).

```bash
cd mobile
npm install
npm start          # mostra um QR Code no terminal
```

Abra o Expo Go e leia o QR Code do terminal. Cada alteração no código aparece no celular na hora.

### Endereço do servidor

No celular, `localhost` é o próprio aparelho. Por isso, o app usa o IP do computador, definido em `.env.local`:

```
EXPO_PUBLIC_API_URL=http://192.168.1.140:3333/api
```

Se mudar de rede, descubra o novo IP com `ipconfig` (campo "Endereço IPv4") e troque-o na tela de login, em **Alterar servidor**. O endereço salvo no aparelho vale mais que o do arquivo.

### Firewall do Windows

O celular precisa acessar duas portas do computador: **3333** (API) e **8081** (servidor do Expo). Se o Expo Go não abrir o app, ou se o login responder "Não foi possível falar com o servidor", libere as portas. Abra o PowerShell **como administrador** e execute:

```powershell
# Marca a rede de casa como privada (redes públicas bloqueiam conexões de entrada)
Set-NetConnectionProfile -InterfaceAlias "Ethernet" -NetworkCategory Private

# Libera as portas do backend e do Expo apenas em redes privadas
New-NetFirewallRule -DisplayName "Presença+ (API e Expo)" -Direction Inbound -Protocol TCP -LocalPort 3333,8081 -Action Allow -Profile Private
```

Troque `"Ethernet"` pelo nome da conexão do computador (veja com `Get-NetConnectionProfile`). Em uma rede pública, como a da universidade, use `npm start -- --tunnel` para o Expo. A API, porém, ainda precisa estar acessível pela rede.

## Telas

| Tela                 | Arquivo                  | Função                                                                     |
| -------------------- | ------------------------ | -------------------------------------------------------------------------- |
| Login                | `src/app/login.tsx`      | matrícula + senha (`POST /auth/login/aluno`)                               |
| Início               | `src/app/index.tsx`      | botão de leitura e frequência por turma, com alerta abaixo de 75%          |
| Registrar presença   | `src/app/escanear.tsx`   | câmera, localização e envio (`POST /presencas`), com o resultado na tela   |
| Histórico            | `src/app/historico.tsx`  | presenças e faltas de cada aula, com filtro (`GET /alunos/me/presencas`)   |

Os arquivos de apoio ficam em `src/lib/`: `api.ts` (chamadas HTTP), `sessao.tsx` e `useSessao.ts` (login guardado no armazenamento seguro do aparelho), `localizacao.ts` e `qr.ts`.

## Cenários de teste da proposta

Cada cenário tem uma mensagem própria no app:

| Cenário                          | O que o aluno vê                                                         |
| -------------------------------- | ------------------------------------------------------------------------ |
| Login inválido                   | "Matrícula ou senha inválidas."                                           |
| QR Code de outro sistema         | "QR Code não reconhecido"                                                 |
| QR Code inválido / expirado      | "QR Code inválido" / "QR Code expirado", com a opção de ler novamente     |
| Fora do raio de 20 m             | "Você está fora da sala", com a distância calculada                      |
| Registro duplicado               | "Presença já registrada"                                                  |
| Chamada encerrada / outra turma  | "Chamada encerrada" / "Turma diferente"                                   |
| Sem internet                     | "Sem conexão": não foi possível falar com o servidor                     |
| Permissão de localização negada  | explicação e, se bloqueada, botão para abrir as configurações            |
| Localização desligada / sem sinal| pede para ativar a localização ou tentar perto de uma janela             |
| Permissão da câmera negada       | explicação e botão para permitir ou abrir as configurações               |

## Privacidade (LGPD)

- A localização é lida **uma única vez**, ao abrir a tela de registro, e enviada apenas junto com o QR Code lido. Não há rastreamento contínuo nem acesso em segundo plano.
- A câmera é usada só para ler o QR Code; nenhuma imagem é gravada ou enviada.
- O token de login fica no armazenamento seguro do Android (Keystore) e é apagado ao sair.

## Gerar o APK (instalar sem o Expo Go)

O APK é instalado como um aplicativo comum e não depende do Expo Go nem do computador rodando o `npm start`. Só o backend precisa estar ligado. Ele é gerado na nuvem pelo EAS, serviço da Expo; não é preciso instalar o Android Studio.

**Uma vez só:**

1. Crie uma conta gratuita em [expo.dev/signup](https://expo.dev/signup).
2. No terminal, dentro da pasta `mobile`, entre na conta:

   ```bash
   npx eas-cli@latest login
   ```

**Para gerar o APK:**

```bash
npx eas-cli@latest build --platform android --profile preview
```

Na primeira vez, o comando pergunta se pode criar o projeto na sua conta Expo e se pode gerar a chave de assinatura do Android: responda **sim** (Y) às duas. Ele grava o id do projeto em `app.json`. A geração leva alguns minutos, numa fila gratuita.

No fim, o terminal mostra um link e um QR Code. Abra o link no celular, baixe o APK e instale. O Android pede para permitir a instalação de "fontes desconhecidas" para o navegador: é normal, porque o app não veio da Play Store.

**Endereço do servidor no APK:** o `.env.local` não é enviado para o EAS. O endereço padrão do APK fica em `eas.json` (campo `env` do perfil `preview`). Se mudar de rede, não é preciso gerar outro APK: na tela de login, toque em **Alterar servidor**, digite o IP do computador (por exemplo, `192.168.1.140`) e toque em **Testar e salvar**. O app completa a porta e o `/api`, confere se o backend responde e guarda o endereço no aparelho.

**Quando gerar de novo:** sempre que o código do app mudar. Durante o desenvolvimento, o Expo Go continua mais prático, porque as alterações aparecem na hora. Gere o APK quando quiser testar a versão final, por exemplo em sala de aula. O plano gratuito do EAS tem uma cota mensal de builds.

O app aceita `http://` (sem HTTPS) por causa de `usesCleartextTraffic` em `app.json`, necessário para falar com o backend local. Em produção, o backend deveria usar HTTPS.

## Verificações

```bash
npm run typecheck   # TypeScript
npm run lint        # ESLint
npx expo-doctor     # dependências e configuração do Expo
```
