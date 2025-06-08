import { Component, ElementRef, HostListener, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { MarkdownModule } from 'ngx-markdown';
import { provideMarkdown } from 'ngx-markdown'
import { ClipboardModule, ClipboardService } from 'ngx-clipboard';
import { v4 as uuidv4 } from 'uuid';
import { environment } from '../../environments/environment';
import { OpenAIClient, AzureKeyCredential } from '@azure/openai';
import {
    IconDefinition, faAngleDown, faArrowDown, faCheck, faClose, faCog, faDatabase, faE, faEdit, faFileWord, faGavel, faGlobe,
    faGraduationCap, faMoon, faPaperclip, faStop, faTrashAlt
} from '@fortawesome/free-solid-svg-icons';
import { ClausesService } from '../services/clauses.service';

@Component({
    selector: 'app-chat',
    standalone: true,
    imports: [
        CommonModule,
        FontAwesomeModule,
        FormsModule,
        MarkdownModule,
        ClipboardModule
    ],
    providers: [
        provideMarkdown()
    ],
    templateUrl: './chat.component.html',
    styleUrl: './chat.component.scss',
    encapsulation: ViewEncapsulation.None
})
export class ChatComponent implements OnInit {
    @ViewChild('advancedOptionsDialog') advancedOptionsDialog!: ElementRef;
    @ViewChild('conversationSettingsOutputDialog') conversationSettingsOutputDialog!: ElementRef;
    @ViewChild('databaseOutputDialog') databaseOutputDialog!: ElementRef;
    @ViewChild('databaseSelect') databaseSelect!: ElementRef;
    @ViewChild('fileUpload') fileUpload!: ElementRef;
    @ViewChild('saveOutputDialog') saveOutputDialog!: ElementRef;
    @ViewChild('textareaChat') textareaChat!: ElementRef;

    cancelGeneration = false;
    clauses = '';
    clauseHeading = '';
    codeblocks = new Array<string>();
    codeblocksCounter = 0;
    contractClauses: string[] = [];
    configuration = {
        apiKey: '',
        apiVersion: '',
        azureEndpoint: '',
        deployment: '',
        deployments: [{ name: '', description: '', threshold: '' }],
        documentClausesEndpoint: '',
        documentServerlessEndpoint: '',
        documentSearchEndpoint: '',
        documentThreshold: 0,
        exportServerlessEndpoint: '',
        websiteServerlessEndpoint: '',
        wordServerlessEndpoint: ''
    };
    displayToBottom = false;
    displayPromptFlow = false;
    displaySettings = false;
    displaySettingsModel = false;
    examplePrompts = new Array<{
        prompt: string,
        flow: string | null,
        icon: IconDefinition,
        colour: string
    }>();
    iconCheckmark = faCheck;
    iconClose = faClose;
    iconDatabase = faDatabase;
    iconDelete = faTrashAlt;
    iconDocument = faPaperclip;
    iconDown = faArrowDown;
    iconDropdown = faAngleDown;
    iconEdit = faEdit;
    iconLegal = faGavel;
    iconMoon = faMoon;
    iconSchool = faGraduationCap;
    iconSettings = faCog;
    iconStop = faStop;
    iconWebsite = faGlobe;
    iconWord = faFileWord;
    isDarkMode = false;
    loading = false;
    messages = '';
    messagesContext = new Array<{
        role: '',
        content: ''
    }>();
    messagesDocuments = new Array<{
        filename: '',
        content: '',
        pages: [],
        filter: '',
        statistics: ''
    }>();
    outputCode = '';
    outputFilename = '';
    persona = {
        id: '',
        name: '',
        prompt: '',
        instruction: ''
    };
    personas = new Array<any>();
    prompt = '';
    promptFlow = '';
    performThresholdSearch = false;
    selectedFiles: File[] = [];
    stopGeneration = false;
    summaryCount = 1;
    title = '';
    titleTemporary = '';

    constructor(
        private clausesService: ClausesService,
        private clipboardService: ClipboardService
    ) { }

    async ngOnInit(): Promise<void> {
        this.configuration = {
            apiKey: environment.api_key,
            apiVersion: environment.api_version,
            azureEndpoint: environment.azure_endpoint,
            deployment: environment.deployment,
            deployments: environment.deployments as [any],
            documentClausesEndpoint: environment.document_clauses_endpoint,
            documentServerlessEndpoint: environment.document_serverless_endpoint,
            documentSearchEndpoint: environment.document_search_endpoint,
            documentThreshold: environment.document_threshold,
            exportServerlessEndpoint: environment.export_serverless_endpoint,
            websiteServerlessEndpoint: environment.website_serverless_endpoint,
            wordServerlessEndpoint: environment.word_serverless_endpoint
        };

        this.examplePrompts = this.getExamplePrompts();
    }

    @HostListener('click', ['$event.target'])
    async onDocumentClick(element: any) {
        if (element instanceof HTMLSpanElement && element.classList.contains('code-copy')) {
            const values = element.classList.value.replace('copy code-copy d-print-none ', '');
            const indexLanguage = values.trim().split(' ');

            let code = this.codeblocks[+(indexLanguage[0])];

            if (code.startsWith(`${indexLanguage[1]}\n`)) {
                code = code.slice(indexLanguage[1].length + 1);
            }

            this.clipboardService.copy(code);

            return;
        }

        if (element instanceof HTMLSpanElement && element.classList.contains('code-download')) {
            const values = element.classList.value.replace('download code-download d-print-none ', '');
            const indexLanguageExtension = values.trim().split(' ');

            let code = this.codeblocks[+(indexLanguageExtension[0])];

            if (code.startsWith(`${indexLanguageExtension[1]}\n`)) {
                code = code.slice(indexLanguageExtension[1].length + 1);
            }

            this.outputCode = code;
            this.outputFilename = `output.${indexLanguageExtension[2]}`;
            this.onOutputFilename();

            return;
        }
    }

    @HostListener('document:keydown.escape', ['$event'])
    handleEscape(event: KeyboardEvent) {
        if (!event) {
            return;
        }

        document.body.classList.remove('dialog-opened');
    }

    @HostListener('window:scroll', ['$event'])
    @HostListener('window:resize', ['$event'])
    onWindowScroll(event: any) {
        if (!event) {
            return;
        }

        const scrollPosition = window.innerHeight + window.scrollY;

        const element = document.querySelector('.flex-grow-1') as HTMLElement;

        if (scrollPosition !== +element.offsetHeight) {
            this.displayToBottom = true;
        }

        if ((scrollPosition - 120) > +element.offsetHeight) {
            this.displayToBottom = false;
        }
    }

    getAdvancedMessageDocuments(): any[] {
        return this.messagesDocuments.filter(x => x.pages.length > 0);
    }

    getAdvancedOptions(): boolean {
        return this.messagesDocuments && this.messagesDocuments.filter(x => x.pages.length).length > 0
    }

    getArrayElements(ranges: string, elementsArray: any[]): any[] {
        const parts = ranges.split(/[,;]/);

        let results: any[] = [];

        parts.forEach(x => {
            x = x.trim();

            if (x.includes('-')) {
                let [start, end] = x.replaceAll(' ', '').split('-').map(num => parseInt(num, 10) - 1);

                if (!isNaN(start) && !isNaN(end)) {
                    if (start > end) {
                        const temp = start;
                        end = start;
                        start = temp;
                    }

                    if (end > elementsArray.length) {
                        end = elementsArray.length
                    }

                    for (let i = start; i <= end; i++) {
                        if (elementsArray[i] !== undefined) {
                            results.push(elementsArray[i]);
                        }
                    }
                }
            } else {
                const index = parseInt(x, 10) - 1;
                if (!isNaN(index) && elementsArray[index] !== undefined) {
                    results.push(elementsArray[index]);
                }
            }
        });

        return results;
    }

    getExamplePrompts(): any[] {
        const examples = new Array<{
            prompt: '',
            flow: string | null,
            icon: IconDefinition,
            color: ''
        }>();

        examples.push({
            prompt: 'Provide an explanation for the concepts that make up the SOLID principle in programming. I\'m curious since I\'m learning to code.',
            flow: null,
            icon: this.iconSchool,
            colour: this.getRandomColor()
        } as any);

        examples.push({
            prompt: 'Summarize the key details of a court case; include the parties involved, the court and jurisdiction, the main issues, facts, and decision.',
            flow: 'Before continuing, please attach the document(s) for summarization.',
            icon: this.iconLegal,
            colour: this.getRandomColor()
        } as any);

        examples.push({
            prompt: 'I found this interesting website that might be useful. I would love to send my team a summary. Please help with drafting the email. ',
            flow: 'Before continuing provide the URL(s) for any site you are interested in.',
            icon: this.iconWebsite,
            colour: this.getRandomColor()
        } as any);

        return examples;
    }

    getFirstWordsByLength(text: string, length: number = 10000): string {
        const words = text.split(/\b(?=\w)/u);

        const firstWords = words.slice(0, length);

        return firstWords.join(" ");
    }


    getPersonas(): Array<any> {
        const personas = localStorage.getItem('AzureOpenAIDemo_Personas');

        if (personas) {
            const data = JSON.parse(personas) as Array<{
                id: number,
                name: string,
                prompt: string,
                instruction: string
            }>;

            console.log(personas);

            return data;
        }

        return [];
    }

    getRandomColor(): string {
        const colours = ["#ED6262", "#E2C541", "#76D0EB", "#CB8BD0"];

        const randomIndex = Math.floor(Math.random() * colours.length);

        return colours[randomIndex];
    }

    getTextBetweenCodeBlocks(text: string) {
        const regex = /```([\s\S]*?)```/g;

        let match: RegExpExecArray | null;

        while ((match = regex.exec(text)) !== null) {
            this.codeblocks.push(match[1].trim());
        }
    }

    getTextFromCodeBlockClass(text: string): string {
        if (!this.codeblocks || (this.codeblocks && this.codeblocks.length === 0)) {
            return text;
        }

        const textParts = text.split('\n');

        let count = 0;

        for (let i = 0; i < textParts.length; i++) {
            if (textParts[i].startsWith('```')) {
                count = count + 1;

                if (count % 2 === 1) {
                    let language = textParts[i].replace('```', '');

                    if (language.length === 0) {
                        language = 'markdown';
                    }

                    let extension = language.toLocaleLowerCase();

                    if (extension === 'typescript') {
                        extension = 'ts';
                    } else if (extension === 'javascript') {
                        extension = 'js';
                    } else if (extension === 'python') {
                        extension = 'py';
                    }

                    textParts[i] = `<span class="language-selector">${language} <span class="copy code-copy d-print-none ${this.codeblocksCounter} ${language}">Copy</span> <span class="download code-download d-print-none ${this.codeblocksCounter} ${language} ${extension}">Download</span></span>\n` + textParts[i];

                    this.codeblocksCounter = this.codeblocksCounter + 1;
                }
            }
        }

        text = textParts.join('\n');

        return text;
    }

    getTimestamp(): string {
        const now = new Date();

        return `${now.toDateString()}, ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    }

    onCancelGeneration() {
        this.stopGeneration = false;
        this.cancelGeneration = true;
    }

    onDeleteMessages() {
        this.cancelGeneration = false;
        this.clauses = '';
        this.clauseHeading = '';
        this.contractClauses = [];
        this.codeblocks = [];
        this.codeblocksCounter = 0;
        this.configuration.deployment = environment.deployment;
        this.configuration.documentThreshold = environment.document_threshold;
        this.displayToBottom = false;
        this.displayPromptFlow = false;
        this.displaySettings = false;
        this.displaySettingsModel = false;
        this.fileUpload.nativeElement.value = '';
        this.messages = '';
        this.messagesContext = [];
        this.messagesDocuments = [];
        this.outputCode = '';
        this.outputFilename = '';
        this.performThresholdSearch = false;
        this.persona = {
            id: uuidv4().toString(),
            name: '',
            prompt: '',
            instruction: ''
        };
        this.personas = [];
        this.prompt = '';
        this.promptFlow = '';
        this.selectedFiles = [];
        this.summaryCount = 1;
        this.stopGeneration = false;
        this.textareaChat.nativeElement.focus();
        this.title = '';
        this.titleTemporary = '';
    }

    async onDatabase() {
        document.body.classList.add('dialog-opened');
        this.databaseOutputDialog.nativeElement.showModal();
    }

    async onDatabaseChange(event: any) {
        if (event === 'manually') {
            if (this.clauses.trim().length > 0) {
                this.databaseSelect.nativeElement.value = '';
                this.contractClauses = [];
                this.clauseHeading = '';
            }

            return;
        }

        if (event === 'database-kaggle-contracts.csv') {
            this.clauses = '';

            const records = this.clausesService.getClausesContracts().split('\n');

            this.contractClauses = [];
            this.clauseHeading = `Loaded ${records.length - 1} record(s) from database. Showing 100.`;

            for (let i = 0; i < records.length; i++) {
                if (i == 0)
                    continue;

                const values = records[i].split(',contracts');

                if (values[0].replace('Contracts. ', '').trim().length > 0)
                    this.contractClauses.push(values[0].replace('Contracts. ', '').replaceAll('""', '"').trim());

                if (i === 100)
                    break;
            }

            return;
        }

        if (event === 'database-kaggle-websites.csv') {
            this.clauses = '';

            const records = this.clausesService.getClausesWebsites().split('\n');

            this.contractClauses = [];
            this.clauseHeading = `Loaded ${records.length - 1} record(s) from database. Showing 100.`;

            for (let i = 0; i < records.length; i++) {
                if (i == 0)
                    continue;

                let websiteUrl = records[i].substring(0, records[i].indexOf(' '));
                websiteUrl = websiteUrl.split(',')[0];

                let description = records[i].substring(records[i].indexOf(' '), records[i].length);

                this.contractClauses.push(`${websiteUrl} ${description}`);

                if (i === 100)
                    break;
            }

            return;
        }

        if (event === 'database-openai-employees.csv') {
            this.clauses = '';

            const records = this.clausesService.getClausesEmployees().split('\n');

            this.contractClauses = [];
            this.clauseHeading = `Loaded ${records.length - 1} record(s) from database. Showing 100.`;

            for (let i = 0; i < records.length; i++) {
                if (i == 0)
                    continue;

                this.contractClauses.push(this.clausesService.getClauseEmployee(records[i]));

                if (i === 100)
                    break;
            }

            return;
        }

        this.clauseHeading = '';
        this.contractClauses = [];
    }

    onDatabaseClose() {
        document.body.classList.remove('dialog-opened');
        this.databaseOutputDialog.nativeElement.close();
    }

    async onDatabaseSearch() {
        this.onDatabaseClose();

        let clauses = this.clauses;
        let similarity = 0.30;

        if (clauses.trim().length === 0) {
            if (this.databaseSelect.nativeElement.value === 'database-kaggle-contracts.csv') {
                clauses = this.clausesService.getClausesContracts();
                similarity = 0.75;
            } else if (this.databaseSelect.nativeElement.value === 'database-openai-employees.csv') {
                clauses = this.clausesService.getClausesEmployees();
                similarity = 0.35;
            } else if (this.databaseSelect.nativeElement.value === 'database-kaggle-websites.csv') {
                clauses = this.clausesService.getClausesWebsites();
                similarity = 0.85;
            }
        }

        this.loading = true;

        for (let i = 0; i < this.messagesDocuments.length; i++) {
            try {
                const response = await fetch(this.configuration.documentClausesEndpoint, {
                    method: "POST",
                    body: JSON.stringify({
                        "content": this.messagesDocuments[i].content.replaceAll('\r\n', ' ').replaceAll('\n', ' ') as string,
                        "clauses": clauses,
                        "similarity": similarity
                    } as any),
                    headers: {
                        "Accept": "*/*"
                    }
                });

                const data = await response.json();

                if (data && data[0]) {
                    let additionalContent = '';
                    let additionalContentHTML = '';

                    (data as Array<any>).forEach(y => {
                        let clause = y.clause;

                        if (this.databaseSelect.nativeElement.value === 'database-openai-employees.csv') {
                            clause = this.clausesService.getClauseEmployee(clause);
                        }

                        additionalContent += clause + ' ' + y.similarity + '\r\n';
                        additionalContentHTML += `<tr><td>${clause}</td><td style="text-align: right;">${y.similarity}</td></tr>`;
                    });

                    if (additionalContent.length > 0) {
                        this.messagesContext.push({ role: 'user', content: `The document "${this.messagesDocuments[i].filename}" has additional content found in clauses databases. The content is: ${additionalContent}` } as any);

                        this.messages += `Document <b>${this.messagesDocuments[i].filename}</b> contains the following based on a similarity score greater than ${similarity}: <table><thead><tr><th>Reference</th><th style="width: 80px;">Similarity</th></tr></thead><tbody>${additionalContentHTML}</tbody></table>`;
                    }
                    else {
                        this.messages += `Document <b>${this.messagesDocuments[i].filename}</b> does not contain any of the provided clauses.`;
                    }
                } else {
                    this.messages += `Document <b>${this.messagesDocuments[i].filename}</b> does not contain any of the provided clauses.`;
                }

                this.scrollToBottom();
            } catch (error) {
                console.error('Error fetching data:', error);
            }
        }

        this.loading = false;

        this.messages += `<span class="mb-4 mt-4 timestamp timestamp-system">${this.getTimestamp()}</span>`;
    }

    onDeploymentChange(element: any, configuration: any) {
        element.stopPropagation();

        this.configuration.deployment = configuration.name;
        this.configuration.documentThreshold = configuration.threshold;

        setTimeout(() => {
            this.displaySettingsModel = false;
        }, 1500);
    }

    onDocumentsChange(element: any) {
        const files = Array.from(element.target.files) as File[];

        this.selectedFiles = [...this.selectedFiles, ...files];

        this.displayPromptFlow = false;
        this.promptFlow = '';
    }

    onDocumentsClick(element: any) {
        if (element) {
            element.preventDefault();
        }

        this.fileUpload.nativeElement.click();
    }

    onDocumentDelete(index: number) {
        if (this.loading) {
            return;
        }

        this.selectedFiles.splice(index, 1);
        this.fileUpload.nativeElement.value = '';
    }

    async onExportConversation() {
        const regexTimestamps = /<span class="[^>]*timestamp[^>]*">.*?<\/span>/g;
        const regexLanguages = /<span class="[^>]*language-selector[^>]*">.*?<\/span>/g;
        const regexDownload = /<span class="[^>]*download code-download[^>]*">.*?<\/span>/g;

        const content = this.messages.replace(regexTimestamps, '').replace(regexLanguages, '').replace(regexDownload, '');

        const response = await fetch(this.configuration.wordServerlessEndpoint, {
            method: "POST",
            body: JSON.stringify({
                "content": content
            } as any),
            headers: {
                "Accept": "*/*"
            }
        });

        const data = await response.body as ReadableStream<Uint8Array>;

        const reader = data.getReader();
        const chunks: Uint8Array[] = [];
        let done = false;

        while (!done) {
            const { done: streamDone, value } = await reader.read();
            if (streamDone) {
                done = true;
            } else {
                chunks.push(value);
            }
        }

        const blob = new Blob(chunks, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.title.toLocaleLowerCase().replace(/[^a-zA-Z0-9 ]/g, '').replaceAll(' ', '-')}-conversation.docx`;

        document.body.appendChild(a);
        a.click();

        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async onExportMarkdown(content: string) {
        const response = await fetch(this.configuration.exportServerlessEndpoint, {
            method: "POST",
            body: JSON.stringify({
                "content": content
            } as any),
            headers: {
                "Accept": "*/*"
            }
        });

        const data = await response.body as ReadableStream<Uint8Array>;

        const reader = data.getReader();
        const chunks: Uint8Array[] = [];
        let done = false;

        while (!done) {
            const { done: streamDone, value } = await reader.read();
            if (streamDone) {
                done = true;
            } else {
                chunks.push(value);
            }
        }

        const blob = new Blob(chunks, { type: 'text/plain' });

        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = this.outputFilename;

        document.body.appendChild(a);
        a.click();

        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    onModelSettings(element: any) {
        element.stopPropagation();

        this.displaySettings = false;
        this.displaySettingsModel = !this.displaySettingsModel;
    }

    onModelSettingsClose() {
        this.displaySettingsModel = false;
    }

    onNewConversation(persona: string) {
        this.onDeleteMessages();
    }

    onNewConversationSettings() {
        this.persona = {
            id: uuidv4().toString(),
            name: '',
            prompt: '',
            instruction: ''
        };

        this.personas = this.getPersonas();

        document.body.classList.add('dialog-opened');
        this.conversationSettingsOutputDialog.nativeElement.showModal();
    }

    onNewConversationSettingsClose() {
        document.body.classList.remove('dialog-opened');
        this.conversationSettingsOutputDialog.nativeElement.close();
    }

    onNewConversationSettingsDelete(id: string) {
        const personas = localStorage.getItem('AzureOpenAIDemo_Personas');

        if (personas) {
            let data = JSON.parse(personas) as Array<{
                id: string,
                name: string,
                prompt: string,
                instruction: string
            }>;

            if (data.filter(x => x.id === id).length > 0) {
                data = data.filter(x => x.id !== id);
            }

            localStorage.setItem('AzureOpenAIDemo_Personas', JSON.stringify(data));
        }

        this.personas = this.getPersonas();
    }

    onNewConversationSettingsEdit(id: string) {
        const personas = localStorage.getItem('AzureOpenAIDemo_Personas');

        if (personas) {
            const data = JSON.parse(personas) as Array<{
                id: string,
                name: string,
                prompt: string,
                instruction: string
            }>;

            const persona = data.find(x => x.id === id);

            if (persona) {
                this.persona.id = persona.id;
                this.persona.name = persona.name;
                this.persona.prompt = persona.prompt;
                this.persona.instruction = persona.instruction;
            }
        }
    }

    onNewConversationSettingsSave() {
        if (this.persona.name.length > 0 && this.persona.prompt.length > 0) {
            const personas = localStorage.getItem('AzureOpenAIDemo_Personas');

            if (personas) {
                let data = JSON.parse(personas) as Array<{
                    id: string,
                    name: string,
                    prompt: string,
                    instruction: string
                }>;

                if (data.filter(x => x.id === this.persona.id).length > 0) {
                    data = data.filter(x => x.id !== this.persona.id);
                }

                data.push(this.persona);

                localStorage.setItem('AzureOpenAIDemo_Personas', JSON.stringify(data));
            } else {
                const data = new Array<{
                    id: string,
                    name: string,
                    prompt: string,
                    instruction: string
                }>();

                data.push(this.persona);

                localStorage.setItem('AzureOpenAIDemo_Personas', JSON.stringify(data));
            }

            this.persona = {
                id: uuidv4().toString(),
                name: '',
                prompt: '',
                instruction: ''
            };

            this.personas = this.getPersonas();
        }
    }

    onNewConversationSettingsStart(event: any, id: number) {
        event.preventDefault();

        const personas = localStorage.getItem('AzureOpenAIDemo_Personas');

        if (personas) {
            const data = JSON.parse(personas) as Array<{
                id: number,
                name: string,
                prompt: string,
                instruction: string
            }>;

            const persona = data.find(x => x.id === id);

            if (persona) {
                this.onPromptCreate(persona.prompt, persona.instruction);
            }
        }

        this.onNewConversationSettingsClose();
    }

    onOutputFilename() {
        document.body.classList.add('dialog-opened');
        this.saveOutputDialog.nativeElement.showModal();
    }

    async onOutputFilenameSave() {
        document.body.classList.remove('dialog-opened');
        this.saveOutputDialog.nativeElement.close();

        if (this.outputFilename.trim().length === 0) {
            return;
        }

        await this.onExportMarkdown(this.outputCode);
    }

    onPromptCreate(prompt: string, flow: string | null = null) {
        this.prompt = prompt;

        if (flow !== null && flow.length > 0) {
            this.promptFlow = flow;
            this.displayPromptFlow = true;
        } else {
            this.onSend();
        }
    }

    onPromptCancel() {
        this.prompt = '';
        this.promptFlow = '';
        this.displayPromptFlow = false;
    }

    async onSend() {
        if (this.prompt.replace(/\s/g, '').length === 0) {
            return;
        }

        await this.sendMessage(this.prompt);
        this.reduceMessageContext();

        this.prompt = '';
        this.promptFlow = '';
        this.displayPromptFlow = false;
        this.selectedFiles = [];
        this.fileUpload.nativeElement.value = '';
    }

    onSettings() {
        this.displaySettings = true;
        this.titleTemporary = this.title;

        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }

    onSettingsCancel() {
        this.displaySettings = false;
    }

    onSettingsSave() {
        if (this.titleTemporary.replace(/\s/g, '').length !== 0) {
            this.title = this.titleTemporary;
            this.titleTemporary = '';
            this.onSettingsCancel();
        }
    }

    onSettingsAdvanced() {
        document.body.classList.add('dialog-opened');
        this.advancedOptionsDialog.nativeElement.showModal();
    }

    onSettingsAdvancedSave() {
        document.body.classList.remove('dialog-opened');
        this.advancedOptionsDialog.nativeElement.close();
    }

    onToggleTheme() {
        const htmlTag = document.querySelector('html');

        this.isDarkMode = !this.isDarkMode;

        if (this.isDarkMode) {
            htmlTag?.classList.add('dark-mode');
        } else {
            htmlTag?.classList.remove('dark-mode');
        }
    }

    reduceMessageContext() {
        if (this.messagesContext.length <= 5) {
            return;
        }

        if (this.configuration.documentThreshold === 0) {
            this.messagesContext = this.messagesContext.filter(x => !x.content.includes(', integrate it with your reply. The content is: '));
        }

        if (this.messagesContext.length > 5) {
            for (let i = 0; i < this.messagesContext.length; i++) {
                if (this.messagesContext[i].role.includes('user') && !this.messagesContext[i].content.includes(', integrate it with your reply. The content is: ')) {
                    if (this.messagesContext[i].content.split(' ').length > 500) {
                        this.messagesContext[i].content = this.getFirstWordsByLength(this.messagesContext[i].content, 400) as any;
                    }
                }
            }
        }

        if (this.messagesContext.length > 10) {
            const userMessagesContextCount = this.messagesContext.filter(x => x.role.includes('user')).length;
            const systemMessagesContextCount = this.messagesContext.filter(x => x.role.includes('system')).length;

            let deletedUserMessages = 0;
            let deletedSystemMessages = 0;

            for (let i = 0; i < this.messagesContext.length; i++) {
                if (this.messagesContext[i].role.includes('user')) {
                    if (deletedUserMessages >= userMessagesContextCount - 3) {
                        continue;
                    }

                    this.messagesContext.splice(i, 1);

                    i--;
                    deletedUserMessages++;
                }
            }

            if (systemMessagesContextCount >= 5) {
                for (let i = 0; i < this.messagesContext.length; i++) {
                    if (this.messagesContext[i].role.includes('system')) {
                        if (deletedSystemMessages >= systemMessagesContextCount - 3) {
                            continue;
                        }

                        this.messagesContext.splice(i, 1);

                        i--;
                        deletedSystemMessages++;
                    }
                }
            }
        }
    }

    scrollToBottom() {
        setTimeout(() => {
            window.scrollTo({
                top: document.body.scrollHeight + 500,
                behavior: 'smooth'
            });
        }, 250);
    }

    async sendDocuments() {
        if (this.selectedFiles.length === 0) {
            return;
        }

        const formData = new FormData();
        const selectedFiles = this.selectedFiles;

        for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];
            formData.append(`file${i}`, file);
        }

        try {
            this.loading = true;
            let fileNames = '';
            let documentsAboveThreshold = '';
            let emptyDocuments = '';

            this.messages += `<div class="alert alert-info">Larger PDF, Word, text, and markdown documents may take longer to process. Attaching ${selectedFiles.length} document${selectedFiles.length !== 1 ? 's' : ''} to conversation. Please wait.<span class="mt-4 timestamp timestamp-system">${this.getTimestamp()}</span></div>`;

            const response = await fetch(this.configuration.documentServerlessEndpoint, {
                method: "POST",
                body: formData,
                headers: {
                    "Accept": "*/*"
                }
            });

            const data = await response.json();

            if (data && data[0]) {
                (data as Array<any>).forEach(x => {
                    if (x.extension === "Unknown") {
                        this.messagesContext.push({ role: 'user', content: `The document "${x.filename}" is not supported. Only Word, PDF, text, and markdown are supported.` } as any);
                    } else {
                        let content = x.content.toString();

                        this.messagesDocuments.push({ filename: x.filename, content, pages: x.pages, filter: '', statistics: `Contains ${(+x.statistics.words).toLocaleString('en-US')} on ${x.statistics.pages} page(s)` } as any);

                        if ((x.statistics && x.statistics.words && +x.statistics.words > +this.configuration.documentThreshold) || this.configuration.documentThreshold === 0) {
                            this.performThresholdSearch = true;

                            if (+this.configuration.documentThreshold !== 0) {
                                content = this.getFirstWordsByLength(content, +this.configuration.documentThreshold);
                            } else {
                                content = '';
                            }

                            documentsAboveThreshold += `${x.filename} contains ${(+x.statistics.words).toLocaleString('en-US')} words${x.statistics.pages && x.statistics.pages !== -1 ? ` across ${(+x.statistics.pages).toLocaleString('en-US')} pages` : ''}, `;
                        }

                        if (x.statistics.words === 0) {
                            emptyDocuments += `${x.filename} contains no content that could be processed `;
                        } else if (x.statistics.words !== 0 && this.configuration.documentThreshold !== 0) {
                            this.messagesContext.push({ role: 'user', content: `The document "${x.filename}" has the content: ${content}` } as any);
                        } else {
                            this.messagesContext.push({ role: 'user', content: `The document "${x.filename}" has been added to the conversation.` } as any);
                        }
                    }
                });
            }

            if (documentsAboveThreshold.length > 0) {
                documentsAboveThreshold = `<br />${documentsAboveThreshold} which might affect performance.`;

                if (this.configuration.documentThreshold > 0) {
                    documentsAboveThreshold += ` The first ${(+this.configuration.documentThreshold).toLocaleString('en-US')} words are automatically added to the conversational context.`;
                }
            }

            if (emptyDocuments.length > 0)
                emptyDocuments = '<br />' + emptyDocuments + ' results might be affected.';

            selectedFiles.forEach(x => { fileNames += `<div>${x.name}</div>`; });

            this.messages += `<div class="documents-attached mb-4"><span><b>${selectedFiles.length} Document${selectedFiles.length !== 1 ? 's' : ''} Added</b>.</span>${fileNames}${documentsAboveThreshold}${emptyDocuments}</div>`;

            this.loading = false;

            this.scrollToBottom();
        } catch (error) {
            console.error('Error fetching data:', error);

            this.loading = false;
        }
    }

    async sendSearchDocuments(prompt: string) {
        if (this.messagesDocuments.length === 0 || (this.configuration.documentThreshold !== 0 && prompt.split(' ').length < 4)) {
            return;
        }

        for (let i = 0; i < this.messagesDocuments.length; i++) {
            try {
                this.loading = true;

                let documentContent = this.messagesDocuments[i].content as string;

                if (this.messagesDocuments[i].filter.length > 0) {
                    const refinedContentElements = this.getArrayElements(this.messagesDocuments[i].filter, this.messagesDocuments[i].pages);
                    const refinedContent = refinedContentElements.join(' ');

                    if (refinedContent.trim().length > 0) {
                        documentContent = refinedContent;

                        this.messagesContext.push({ role: 'user', content: `The document "${this.messagesDocuments[i].filename}" has additional content. The content is: ${documentContent}` } as any);
                    }
                }

                const response = await fetch(this.configuration.documentSearchEndpoint, {
                    method: "POST",
                    body: JSON.stringify({
                        "query": prompt,
                        "content": documentContent
                    } as any),
                    headers: {
                        "Accept": "*/*"
                    }
                });

                const data = await response.json();

                if (data && data[0]) {
                    let additionalContent = '';

                    (data as Array<any>).forEach(y => {
                        additionalContent += y.content + '\r\n';
                    });

                    if (additionalContent.length > 0) {
                        this.messagesContext.push({ role: 'user', content: `The document "${this.messagesDocuments[i].filename}" has additional content about "${prompt}", integrate it with your reply. The content is: ${additionalContent}` } as any);
                    }
                }

                this.loading = false;
            } catch (error) {
                console.error('Error fetching data:', error);

                this.loading = false;
            }
        }
    }

    async sendMessage(prompt: string): Promise<void> {
        if (this.prompt.replace(/\s/g, '').length === 0) {
            return;
        }

        console.log(this.prompt);

        try {
            const client = new OpenAIClient(
                this.configuration.azureEndpoint,
                new AzureKeyCredential(this.configuration.apiKey)
            );

            let filteredTimestamp = '';
            if (this.performThresholdSearch && this.messagesDocuments.length > 0) {
                if (this.messagesDocuments.filter(x => x.filter.length).length > 0) {
                    filteredTimestamp = 'This prompt is currently using document filters.<br />';
                }
            }

            this.messages += `<div class="d-flex align-items-end flex-column">
                <div class="message-prompt mb-4 p-3 position-relative">
                    ${this.prompt}<span class="timestamp mt-4">${filteredTimestamp}${this.getTimestamp()}</span>
                </div>
            </div>`;

            await this.sendDocuments();
            await this.sendWebsites(this.prompt);

            this.scrollToBottom();

            const messages = [
                {
                    role: 'system', content: 'You are a helpful assistant.'
                }
            ];

            if (this.performThresholdSearch && this.messagesDocuments.length > 0) {
                await this.sendSearchDocuments(prompt);
            }

            this.messagesContext.forEach(x => {
                messages.push({ role: x.role, content: x.content });
            });

            if (this.summaryCount === 1) {
                prompt += '\n\nAt the very end of your reply, summarize this conversation in 5 words but insert it in an HTML comment in the format <!--SUMMARY: YOUR SUMMARY HERE -->'
            }

            messages.push({ role: 'user', content: prompt });

            this.loading = true;

            let systemMessage = '';
            let events = await client.streamChatCompletions(this.configuration.deployment, messages);

            this.stopGeneration = true;

            for await (const event of events) {
                for (const choice of event.choices) {
                    if (this.cancelGeneration === true) {
                        this.stopGeneration = false;
                        this.cancelGeneration = false;

                        this.messages += "<br /><br />"

                        throw new Error('Actually, it looks like you cancelled the prompt. Uhm?');
                    }

                    let delta = choice.delta?.content;

                    if (delta !== undefined) {
                        this.messages += delta;
                        systemMessage += delta;

                        await new Promise(response => setTimeout(response, 100));

                        this.scrollToBottom();
                    }
                }
            }

            this.getTextBetweenCodeBlocks(systemMessage);

            this.messages = this.messages.replace(systemMessage, this.getTextFromCodeBlockClass(systemMessage));

            this.messagesContext.push({ role: 'user', content: prompt } as any);
            this.messagesContext.push({ role: 'system', content: systemMessage } as any);

            this.messages += `<span class="mb-4 mt-4 timestamp timestamp-system">${this.getTimestamp()}</span>`;
            this.messages = this.messages.replace(/<!--SUMMARY:.*?-->/, '');

            if (this.summaryCount === 1) {
                const regex = /<!--\s*SUMMARY:\s*(.*?)\s*-->/;

                const match = regex.exec(systemMessage);

                if (match && match.length > 1) {
                    this.summaryCount = this.summaryCount + 1;

                    const title = match[1];

                    this.title = this.getFirstWordsByLength(title, 5).replaceAll("' ", "'").replaceAll("  ", " ");
                }
            }
        } catch (error) {
            console.error('Error completing completion:', error);

            this.messagesContext.push({ role: 'user', content: prompt } as any);

            this.messages += `<div class="alert alert-danger">I have encountered an error. ${(error as any).message}<span class="mt-4 timestamp timestamp-system">${this.getTimestamp()}</span></div>`;

            this.scrollToBottom();
        }

        setTimeout(() => {
            this.stopGeneration = false;
            this.cancelGeneration = false;
            this.loading = false;
        }, 1000);

        setTimeout(() => {
            this.textareaChat.nativeElement.focus();
        }, 1500);
    }

    async sendWebsites(prompt: string) {
        const urlRegex = /(https?:\/\/)?\b([\da-z.-]+)\.([a-z.]{2,6})\b([/\w.-]*)*\/?/gi;

        if (!urlRegex.test(prompt)) {
            return;
        }

        let emptyWebsites = '';
        let urls = '';
        let webistesAboveThreshold = '';

        try {
            this.loading = true;

            const response = await fetch(`${this.configuration.websiteServerlessEndpoint}?query=${prompt}`, {
                method: "POST",
                headers: {
                    "Accept": "*/*"
                }
            });

            const data = await response.json();

            if (data && data[0]) {
                (data as Array<any>).forEach(x => {
                    let content = x.content.toString();

                    urls += `<div>${x.url}</div>`;

                    if ((x.statistics && x.statistics.words && +x.statistics.words > +this.configuration.documentThreshold) || this.configuration.documentThreshold === 0) {
                        this.performThresholdSearch = true;

                        this.messagesDocuments.push({ filename: x.url, content } as any);

                        content = this.getFirstWordsByLength(content, 10000);

                        webistesAboveThreshold += `The website <a href="${x.url}" target="_blank">${x.url}</a> contains ${(+x.statistics.words).toLocaleString('en-US')} words, `;
                    }

                    if (x.statistics.words === 0) {
                        emptyWebsites += `${x.url} contains no content that could be processed `;
                    } else if (x.statistics.words !== 0 && this.configuration.documentThreshold !== 0) {
                        this.messagesContext.push({ role: 'user', content: `The website "${x.url}" has the content: ${content}` } as any);
                    } else {
                        this.messagesContext.push({ role: 'user', content: `The website "${x.url}" has been added to the conversation.` } as any);
                    }
                });

                if (webistesAboveThreshold.length > 0)
                    webistesAboveThreshold = '<br />' + webistesAboveThreshold + ' which might affect performance.';

                if (emptyWebsites.length > 0)
                    emptyWebsites = '<br />' + emptyWebsites + ' results might be affected.';

                this.messages += `<div class="documents-attached mb-4"><span><b>${data.length} Website${data.length !== 1 ? 's' : ''} Added</b>.</span>${urls}${webistesAboveThreshold}${emptyWebsites}</div>`;
            }

            this.loading = false;

            this.scrollToBottom();
        } catch (error) {
            console.error('Error fetching data:', error);

            this.loading = false;
        }
    }
}