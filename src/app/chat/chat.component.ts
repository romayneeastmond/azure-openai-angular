import { Component, ElementRef, HostListener, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { MarkdownModule } from 'ngx-markdown';
import { provideMarkdown } from 'ngx-markdown'
import { environment } from '../../environments/environment';
import { OpenAIClient, AzureKeyCredential } from '@azure/openai';
import { faArrowDown, faFileWord, faMoon, faPaperclip, faStop, faTrashAlt } from '@fortawesome/free-solid-svg-icons';
import { env } from 'node:process';

@Component({
	selector: 'app-chat',
	standalone: true,
	imports: [
		CommonModule,
		FontAwesomeModule,
		FormsModule,
		MarkdownModule
	],
	providers: [
		provideMarkdown()
	],
	templateUrl: './chat.component.html',
	styleUrl: './chat.component.scss',
	encapsulation: ViewEncapsulation.None
})
export class ChatComponent implements OnInit {
	@ViewChild('fileUpload') fileUpload!: ElementRef;
	@ViewChild('textareaChat') textareaChat!: ElementRef;

	cancelGeneration = false;
	configuration = {
		apiKey: '',
		apiVersion: '',
		azureEndpoint: '',
		deployment: '',
		documentServerlessEndpoint: '',
		documentSearchEndpoint: '',
		documentThreshold: 0,
		websiteServerlessEndpoint: '',
		wordServerlessEndpoint: ''
	};
	displayToBottom = false;
	iconDelete = faTrashAlt;
	iconDocument = faPaperclip;
	iconDown = faArrowDown;
	iconMoon = faMoon;
	iconStop = faStop;
	iconWord = faFileWord;
	isDarkMode = false;
	loading = false;
	prompt = '';
	messages = '';
	messagesContext = new Array<{
		role: '',
		content: ''
	}>();
	messagesDocuments = new Array<{
		filename: '',
		content: ''
	}>();
	performThresholdSearch = false;
	selectedFiles: File[] = [];
	stopGeneration = false;
	summaryCount = 1;
	title = '';

	ngOnInit(): void {
		this.configuration = {
			apiKey: environment.api_key,
			apiVersion: environment.api_version,
			azureEndpoint: environment.azure_endpoint,
			deployment: environment.deployment,
			documentServerlessEndpoint: environment.document_serverless_endpoint,
			documentSearchEndpoint: environment.document_search_endpoint,
			documentThreshold: environment.document_threshold,
			websiteServerlessEndpoint: environment.website_serverless_endpoint,
			wordServerlessEndpoint: environment.word_serverless_endpoint
		};
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

	getFirstWordsByLength(text: string, length: number = 10000): string {
		const words = text.split(/\b(?=\w)/u);

		const firstWords = words.slice(0, length);

		return firstWords.join(" ");
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
		this.displayToBottom = false;
		this.fileUpload.nativeElement.value = '';
		this.messages = '';
		this.messagesContext = [];
		this.messagesDocuments = [];
		this.performThresholdSearch = false;
		this.selectedFiles = [];
		this.summaryCount = 1;
		this.stopGeneration = false;
		this.textareaChat.nativeElement.focus();
		this.title = '';
	}

	onDocumentsChange(event: any) {
		const files = Array.from(event.target.files) as File[];

		this.selectedFiles = [...this.selectedFiles, ...files];
	}

	onDocumentsClick(event: any) {
		if (event) {
			event.preventDefault();
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
		const regex = /<span class="[^>]*timestamp[^>]*">.*?<\/span>/g;

		const content = this.messages.replace(regex, '');

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

	async onSend() {
		if (this.prompt.replaceAll(' ', '').length === 0) {
			return;
		}

		this.messages += `<div class="d-flex align-items-end flex-column"><div class="message-prompt mb-4 p-3 position-relative">${this.prompt}<span class="timestamp mt-4">${this.getTimestamp()}</span></div></div>`;

		this.scrollToBottom();

		await this.sendDocuments();
		await this.sendWebsites(this.prompt);
		this.sendMessage(this.prompt);
		this.reduceMessageContext();

		this.prompt = '';
		this.selectedFiles = [];
		this.fileUpload.nativeElement.value = '';
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

						if ((x.statistics && x.statistics.words && +x.statistics.words > +this.configuration.documentThreshold) || this.configuration.documentThreshold == 0) {
							this.performThresholdSearch = true;

							this.messagesDocuments.push({ filename: x.filename, content } as any);

							content = this.getFirstWordsByLength(content, 10000);

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

				const response = await fetch(this.configuration.documentSearchEndpoint, {
					method: "POST",
					body: JSON.stringify({
						"query": prompt,
						"content": this.messagesDocuments[i].content
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

	async sendMessage(prompt: string) {
		try {
			const client = new OpenAIClient(
				this.configuration.azureEndpoint,
				new AzureKeyCredential(this.configuration.apiKey)
			);

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

			this.messagesContext.push({ role: 'user', content: prompt } as any);
			this.messagesContext.push({ role: 'system', content: systemMessage } as any);

			this.messages += `<span class="mb-4 mt-4 timestamp timestamp-system">${this.getTimestamp()}</span>`;

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