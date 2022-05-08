# echo-bot

Sample showing the usage of Continue JS with the [Microsoft Bot Framework](https://dev.botframework.com/). This sample is a modification of the Bot Frameworks [Echo Bot Sample](https://github.com/microsoft/BotBuilder-Samples/tree/main/samples/javascript_nodejs/02.echo-bot).

The sample will first prompt the user for their name and then echo back to them anything they say. A very simple memory based [conversation store](./conversationStore.js) to remember the next continuation to execute and the current conversation state.
 
## Usage

To run the sample first follow the [build instructions](../../README.md#building) for the project. Then from a command shell type:

```Bash
$ npm start
``` 

## Testing the bot using Bot Framework Emulator

[Bot Framework Emulator](https://github.com/microsoft/botframework-emulator) is a desktop application that allows bot developers to test and debug their bots on localhost or running remotely through a tunnel.

- Install the latest Bot Framework Emulator from [here](https://github.com/Microsoft/BotFramework-Emulator/releases)

### Connect to the bot using Bot Framework Emulator

- Launch Bot Framework Emulator
- File -> Open Bot
- Enter a Bot URL of `http://localhost:3978/api/messages`

## Deploy the bot to Azure

To learn more about deploying a bot to Azure, see [Deploy your bot to Azure](https://aka.ms/azuredeployment) for a complete list of deployment instructions.
