import { Global, Module } from '@nestjs/common';
import { MockScenarioService } from './mock-scenario.service';

@Global()
@Module({
  providers: [MockScenarioService],
  exports: [MockScenarioService],
})
export class MockModule {}
