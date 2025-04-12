import { Test, TestingModule } from '@nestjs/testing';
import { OrganizersVerificationController } from './organizers-verification.controller';

describe('OrganizersVerificationController', () => {
  let controller: OrganizersVerificationController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizersVerificationController],
    }).compile();

    controller = module.get<OrganizersVerificationController>(OrganizersVerificationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
