import { Module } from '@nestjs/common';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { CoursesModule } from './modules/courses/courses.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { SubmissionsModule } from './modules/submissions/submissions.module';
import { StorageModule } from './modules/storage/storage.module';
import { ArchiveModule } from './modules/archive/archive.module';
import { AdminModule } from './modules/admin/admin.module';
import { SimilarityChecksModule } from './modules/similarity-checks/similarity.module';
import { GradesModule } from './modules/grades/grades.module';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { AuthModule } from './modules/auth/auth.module';
import { DomainCoreModule } from './common/domain-core.module';

@Module({
  imports: [
    InfrastructureModule,
    AuthModule,
    DomainCoreModule,
    AdminModule,
    SimilarityChecksModule,
    GradesModule,
    StorageModule,
    ArchiveModule,
    DashboardModule,
    CoursesModule,
    SubmissionsModule,
    ReviewsModule,
  ],
})
export class AppModule {}
