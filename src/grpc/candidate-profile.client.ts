import path from 'node:path';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { CandidateProfile } from '../types/domain.types';

const PROTO_PATH = path.resolve(__dirname, '../../proto/candidate-profile.proto');

type CandidateProfileGrpcClient = grpc.Client & {
  getProfile(
    request: { candidate_id: string },
    callback: (error: grpc.ServiceError | null, response: Record<string, unknown>) => void,
  ): void;
};

export class CandidateProfileClient {
  private readonly client: CandidateProfileGrpcClient;

  constructor(address: string) {
    const definition = protoLoader.loadSync(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    const loaded = grpc.loadPackageDefinition(definition) as unknown as {
      candidateprofile: { CandidateProfileService: new (address: string, credentials: grpc.ChannelCredentials) => CandidateProfileGrpcClient };
    };
    this.client = new loaded.candidateprofile.CandidateProfileService(address, grpc.credentials.createInsecure());
  }

  getProfile(candidateId: string): Promise<CandidateProfile> {
    return new Promise((resolve, reject) => {
      this.client.getProfile({ candidate_id: candidateId }, (error, response) => {
        if (error) {
          reject(error);
          return;
        }
        resolve({
          candidateId: String(response.candidate_id ?? candidateId),
          skills: Array.isArray(response.skills) ? response.skills.map(String) : [],
          experience: Array.isArray(response.experience) ? response.experience.map(String) : [],
          education: Array.isArray(response.education) ? response.education.map(String) : [],
        });
      });
    });
  }
}
