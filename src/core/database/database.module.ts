import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const useProd = configService.get<string>('USE_PROD_DB') === 'true';
        const uri = useProd
          ? configService.get<string>('MONGODB_URI_PROD')
          : configService.get<string>('MONGODB_URI_DEV');

        console.log(
          `🔌 Connecting to MongoDB: ${useProd ? 'PRODUCTION' : 'DEVELOPMENT'} database`,
        );

        return { uri };
      },
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}
