import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthGuard } from './auth/auth.guard';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    })
      // getMe usa @UseGuards(AuthGuard); lo sustituimos para no resolver sus deps.
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('devuelve el mensaje de saludo', () => {
      expect(appController.getHello()).toEqual({
        message: 'Hello World from Trackt API!',
      });
    });
  });
});
