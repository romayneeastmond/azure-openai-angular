# Azure OpenAI Streaming Demo

An Angular 18 project that demonstrates streaming responses from an Azure OpenAI chat completion. System messages are combined using strings, therefore very limited in scope for conversational context or retrieval. Other features lacking.

## How to Use

Edit environment variables

```
export const environment = {
    api_key: '',
    api_version: '',
    azure_endpoint: '',
    deployment: ''
};
```

Run an npm install or update

```
npm i
```

Starting the project will run it on the default Angular location http://localhost:4200

```
ng -o serve
```

## Copyright and Ownership

All terms used are copyright to their original authors.
