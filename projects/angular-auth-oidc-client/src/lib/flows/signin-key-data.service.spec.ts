import { HttpResponse } from '@angular/common/http';
import { TestBed, waitForAsync } from '@angular/core/testing';
import { isObservable, of, throwError } from 'rxjs';
import { createRetriableStream } from '../../test/create-retriable-stream.helper';
import { DataService } from '../api/data.service';
import { DataServiceMock } from '../api/data.service-mock';
import { LoggerService } from '../logging/logger.service';
import { LoggerServiceMock } from '../logging/logger.service-mock';
import { StoragePersistanceService } from '../storage/storage-persistance.service';
import { StoragePersistanceServiceMock } from '../storage/storage-persistance.service-mock';
import { SigninKeyDataService } from './signin-key-data.service';

const DUMMY_JWKS = {
  keys: [
    {
      kid: 'random-id',
      kty: 'RSA',
      alg: 'RS256',
      use: 'sig',
      n: 'some-value',
      e: 'AQAB',
      x5c: ['some-value'],
      x5t: 'some-value',
      'x5t#S256': 'some-value',
    },
  ],
};

describe('Signin Key Data Service', () => {
  let service: SigninKeyDataService;
  let storagePersistanceService: StoragePersistanceService;
  let dataService: DataService;
  let loggerService: LoggerService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        SigninKeyDataService,
        { provide: DataService, useClass: DataServiceMock },
        { provide: LoggerService, useClass: LoggerServiceMock },
        { provide: StoragePersistanceService, useClass: StoragePersistanceServiceMock },
      ],
    });
  });

  beforeEach(() => {
    service = TestBed.inject(SigninKeyDataService);
    storagePersistanceService = TestBed.inject(StoragePersistanceService);
    dataService = TestBed.inject(DataService);
    loggerService = TestBed.inject(LoggerService);
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  describe('getSigningKeys', () => {
    it(
      'throws error when no wellKnownEndpoints given',
      waitForAsync(() => {
        spyOn(storagePersistanceService, 'read').withArgs('authWellKnownEndPoints').and.returnValue(null);
        const result = service.getSigningKeys();

        result.subscribe({
          error: (err) => {
            expect(err).toBeTruthy();
          },
        });
      })
    );

    it(
      'throws error when no jwksUri given',
      waitForAsync(() => {
        spyOn(storagePersistanceService, 'read').withArgs('authWellKnownEndPoints').and.returnValue({ jwksUri: null });
        const result = service.getSigningKeys();

        result.subscribe({
          error: (err) => {
            expect(err).toBeTruthy();
          },
        });
      })
    );

    it(
      'calls dataservice if jwksurl is given',
      waitForAsync(() => {
        spyOn(storagePersistanceService, 'read').withArgs('authWellKnownEndPoints').and.returnValue({ jwksUri: 'someUrl' });
        const spy = spyOn(dataService, 'get').and.callFake(() => of());

        const result = service.getSigningKeys();

        result.subscribe({
          complete: () => {
            expect(spy).toHaveBeenCalledWith('someUrl');
          },
        });
      })
    );

    it(
      'should retry once',
      waitForAsync(() => {
        spyOn(storagePersistanceService, 'read').withArgs('authWellKnownEndPoints').and.returnValue({ jwksUri: 'someUrl' });
        spyOn(dataService, 'get').and.returnValue(createRetriableStream(throwError({}), of(DUMMY_JWKS)));

        service.getSigningKeys().subscribe({
          next: (res) => {
            expect(res).toBeTruthy();
            expect(res).toEqual(DUMMY_JWKS);
          },
        });
      })
    );

    it(
      'should retry twice',
      waitForAsync(() => {
        spyOn(storagePersistanceService, 'read').withArgs('authWellKnownEndPoints').and.returnValue({ jwksUri: 'someUrl' });
        spyOn(dataService, 'get').and.returnValue(createRetriableStream(throwError({}), throwError({}), of(DUMMY_JWKS)));

        service.getSigningKeys().subscribe({
          next: (res) => {
            expect(res).toBeTruthy();
            expect(res).toEqual(DUMMY_JWKS);
          },
        });
      })
    );

    it(
      'should fail after three tries',
      waitForAsync(() => {
        spyOn(storagePersistanceService, 'read').withArgs('authWellKnownEndPoints').and.returnValue({ jwksUri: 'someUrl' });
        spyOn(dataService, 'get').and.returnValue(createRetriableStream(throwError({}), throwError({}), throwError({}), of(DUMMY_JWKS)));

        service.getSigningKeys().subscribe({
          error: (err) => {
            expect(err).toBeTruthy();
          },
        });
      })
    );
  });

  describe('handleErrorGetSigningKeys', () => {
    it(
      'keeps observable if error is catched',
      waitForAsync(() => {
        const result = (service as any).handleErrorGetSigningKeys(new HttpResponse());
        const hasTypeObservable = isObservable(result);
        expect(hasTypeObservable).toBeTrue();
      })
    );

    it(
      'loggs error if error is response',
      waitForAsync(() => {
        const logSpy = spyOn(loggerService, 'logError');
        (service as any).handleErrorGetSigningKeys(new HttpResponse({ status: 400, statusText: 'nono' })).subscribe({
          error: () => {
            expect(logSpy).toHaveBeenCalledWith('400 - nono {}');
          },
        });
      })
    );

    it(
      'loggs error if error is not a response',
      waitForAsync(() => {
        const logSpy = spyOn(loggerService, 'logError');
        (service as any).handleErrorGetSigningKeys('Just some Error').subscribe({
          error: () => {
            expect(logSpy).toHaveBeenCalledWith('Just some Error');
          },
        });
      })
    );

    it(
      'loggs error if error with message property is not a response',
      waitForAsync(() => {
        const logSpy = spyOn(loggerService, 'logError');
        (service as any).handleErrorGetSigningKeys({ message: 'Just some Error' }).subscribe({
          error: () => {
            expect(logSpy).toHaveBeenCalledWith('Just some Error');
          },
        });
      })
    );
  });
});
