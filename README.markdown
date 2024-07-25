# Azure OpenAI Streaming Demo

An Angular 18 project that demonstrates streaming responses from an Azure OpenAI chat completion. System messages are combined using strings, therefore offers limited abiltities to retrieve conversation history. Requires support for a data store in the future. Other features lacking.

## How to Use

Edit environment variables

```
export const environment = {
    production: false,
    api_key: '',
    api_version: '',
    azure_endpoint: '',
    deployment: '',
    deployments: [{
        name: '',
        description: '',
        threshold: 10000
    }],
    document_serverless_endpoint: '',
    document_search_endpoint: '',
    document_threshold: 10000,
    website_serverless_endpoint: '',
    word_serverless_endpoint: ''
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

# Features

## Automatic Dark Mode Detection and CSS Theme Toggle

Application automatically detects a device's dark mode settings. It uses the prefers-color-scheme media feature to determine whether the user has requested the system to use a light or dark color theme. For devices that start in light mode, there is a button (top left) to manually switch between light and dark themes. This is implemented via a toggle button that applies a global CSS class based on the selected theme.

## Select Different Azure OpenAI Models

The environment file contains definitions for a default deployment and then multiple deployments. Below is an example:

```
export const environment = {
    production: false,
    api_key: '',
    api_version: '',
    azure_endpoint: '',
    deployment: 'gpt-4',
    deployments: [{
        name: 'gpt-4',
        description: 'GPT-4 <div class="small">Excels in human-like text with high accuracy and coherence.</div>',
        threshold: 30000
    }, {
        name: 'gpt-4o',
        description: 'GPT-4o <div class="small">Omni channel AI with extremely fast performance and accuracy.</div>',
        threshold: 90000
    }],
    document_serverless_endpoint: '',
    document_search_endpoint: '',
    document_threshold: 30000,
    website_serverless_endpoint: '',
    word_serverless_endpoint: ''
};
```

Users can choose a model by selecting it from a model selector in the application's interface (top area of conversation area). The selected model is then dynamically loaded during the next Azure OpenAI API call by modifying the endpoint configuration with the chosen model's deployment name.

## Adds Live Internet to Any Model

The application also has the feature that enables live internet capabilities for any selected Azure OpenAI model. This is achieved by integration with a [Azure Python Serverless Function](https://github.com/romayneeastmond/azure-python-serverless-functions) endpoint. If the prompt contains one or more valid URL, then the web content is scraped and automatically added to the conversation's context. Uses the document_threshold and threshold environment variables similar to document uploads.

## Support for File Uploads in Multiple Formats

Accepts document uploads in PDF, Word, text, and markdown formats. Uses the document_threshold and threshold environment variables to determine how much of the document to initially load into the conversation's context window. The entire document content is vectorized with the associated prompt, which allows for vectorized searches to return sementatic content into the conversation's context.

## Add Document Filters to Conversation Context

Gives the ability to specify exactly what pages should be added to document context. Ignores document_treshold and threshold environment variables. Furthermore, it allows the filtered sections of the document to be vectorized to return additional semantic content. Got inspiration from print dialogue select ranges, e.g. 1-5, 8, 11-13.

## Instant Interrogation of Documents

Allows for instantaneous interrogation of documents regardless of size or the provided format. This is achieved by integration with two [Azure Python Serverless Functions](https://github.com/romayneeastmond/azure-python-serverless-functions). One responsible for the document load and the other for finding cosine similarities results.

## Automatic Conversation Context Sliding

After every 5 messages, automatically reduces the conversation context window. If document_threshold or threshold is set to 0, automatically removes all previous vectorized searches from context. If document_threshold or threshold is greater than 0, and conversational context is larger than 10, then remove user messages.

After 5 messages, any prompts larger than 500 words are reduced down to 400. Allows for larger prompts to be interrogated within 4 to 5 passes. On subsequent passes, as system messages overtake user messages, then remove system messages from context.

This sliding context window allows vectorized search results, user messages, and system messages to constantly be in balance between 5 to 10 messages within the current conversational context window.

## Export Conversation to Microsoft Word

The application passes the entire conversation messages to an [Azure Python Serverless Function](https://github.com/romayneeastmond/azure-python-serverless-functions) endpoint that returns it as a Word document. This button is located at the top left and only availalbe after at least one message response and not during a loading state. Uses the conversation title as the file name.

## Download Markdown by Extending ngx-markdown

Any response that contains a markdown object, can be copied to the clipboard. In most cases, the resulting code can be downloaded as its native file format. For example, asking the model how to say 'Hello World' in Go, should produce text that can be downloaded to a output.go file. If the language cannot be detected, then markdown is saved using the .markdown extension.

## Copyright and Ownership

All terms used are copyright to their original authors.
