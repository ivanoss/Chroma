export class ErreurHttp extends Error {
  constructor(statut, message) {
    super(message);
    this.statut = statut;
  }
}

export const nonTrouve = (message = 'Ressource introuvable.') => new ErreurHttp(404, message);
export const requeteInvalide = (message) => new ErreurHttp(400, message);
export const conflit = (message) => new ErreurHttp(409, message);
export const interdit = (message = 'Accès refusé.') => new ErreurHttp(403, message);
export const nonAuthentifie = (message = 'Authentification requise.') => new ErreurHttp(401, message);
