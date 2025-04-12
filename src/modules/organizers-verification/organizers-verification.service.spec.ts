import { Test, TestingModule } from '@nestjs/testing';
import { OrganizersVerificationService } from './organizers-verification.service';

describe('OrganizersVerificationService', () => {
  let service: OrganizersVerificationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrganizersVerificationService],
    }).compile();

    service = module.get<OrganizersVerificationService>(OrganizersVerificationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
