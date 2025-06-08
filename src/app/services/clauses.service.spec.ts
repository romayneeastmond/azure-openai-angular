import { TestBed } from '@angular/core/testing';

import { ClausesService } from './clauses.service';

describe('ClausesService', () => {
    let service: ClausesService;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(ClausesService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });
});
