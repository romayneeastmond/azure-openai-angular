import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ChatComponent } from './chat.component';

describe('ChatComponent', () => {
    let component: ChatComponent;
    let fixture: ComponentFixture<ChatComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ChatComponent]
        })
            .compileComponents();

        fixture = TestBed.createComponent(ChatComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should Streaming Demonstration welcome text', () => {
        const welcomeHeader = fixture.nativeElement.querySelector('h4.mb-0');

        expect(welcomeHeader).toBeTruthy();
        expect(welcomeHeader.textContent).toContain('Streaming Demonstration using Azure OpenAI and Angular 18');
    });

    it('should have prompt textarea, document button, and send button', () => {
        const buttonDocumentElement = fixture.debugElement.query(By.css('.document-button')).nativeElement;
        const buttonSendElement = fixture.debugElement.query(By.css('.send-button')).nativeElement;
        const promptTextareaElement = fixture.debugElement.query(By.css('.textarea')).nativeElement;

        expect(buttonDocumentElement).toBeTruthy();
        expect(buttonSendElement).toBeTruthy();
        expect(promptTextareaElement).toBeTruthy();
    });
});
