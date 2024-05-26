import { Component, ElementRef, HostListener, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { MarkdownModule } from 'ngx-markdown';
import { provideMarkdown } from 'ngx-markdown'
import { environment } from '../../environments/environment';
import { OpenAIClient, AzureKeyCredential } from '@azure/openai';
import { faArrowDown, faMoon, faTrashAlt } from '@fortawesome/free-solid-svg-icons';

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
	@ViewChild('textareaChat') textareaChat!: ElementRef;

	configuration = {
		apiKey: '',
		apiVersion: '',
		azureEndpoint: '',
		deployment: ''
	};

	displayToBottom = false;
	iconDelete = faTrashAlt;
	iconDown = faArrowDown;
	iconMoon = faMoon;
	isDarkMode = false;
	loading = false;
	prompt = '';
	messages = '';

	ngOnInit(): void {
		const apiKey = environment.api_key;
		const apiVersion = environment.api_version;
		const azureEndpoint = environment.azure_endpoint;
		const deployment = environment.deployment;

		this.configuration = {
			apiKey,
			apiVersion,
			azureEndpoint,
			deployment
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

		if ((scrollPosition - 60) > +element.offsetHeight) {
			this.displayToBottom = false;
		}
	}

	getTimestamp(): string {
		const now = new Date();

		return `${now.toDateString()}, ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
	}

	onDeleteMessages() {
		this.messages = '';
		this.textareaChat.nativeElement.focus();
	}

	onSend() {
		if (this.prompt.replaceAll(' ', '').length === 0) {
			return;
		}

		this.messages += `<div class="d-flex align-items-end flex-column"><div class="message-prompt mb-4 p-3 position-relative">${this.prompt}<span class="timestamp mt-4">${this.getTimestamp()}</span></div></div>`;

		this.scrollToBottom();

		this.sendMessage(this.prompt);

		this.prompt = '';
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

	scrollToBottom() {
		setTimeout(() => {
			window.scrollTo({
				top: document.body.scrollHeight + 500,
				behavior: 'smooth'
			});
		}, 250);
	}

	async sendMessage(prompt: string) {
		const client = new OpenAIClient(
			this.configuration.azureEndpoint,
			new AzureKeyCredential(this.configuration.apiKey)
		);

		const messages = [
			{ role: 'user', content: prompt },
		];

		this.loading = true;

		const events = await client.streamChatCompletions(this.configuration.deployment, messages);

		for await (const event of events) {
			for (const choice of event.choices) {
				let delta = choice.delta?.content;

				if (delta !== undefined) {
					this.messages += delta;

					this.scrollToBottom();
				}
			}
		}

		this.messages += `<span class="mb-4 mt-4 timestamp timestamp-system">${this.getTimestamp()}</span>`;

		setTimeout(() => {
			this.loading = false;
		}, 1000);

		setTimeout(() => {
			this.textareaChat.nativeElement.focus();
		}, 1500);
	}
}
