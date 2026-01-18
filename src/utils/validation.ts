export interface ValidationError {
  field: string;
  message: string;
}

export class DirectoryValidator {
  static MIN_NAME_LENGTH = 3;
  static MAX_NAME_LENGTH = 50;

  static validateName(name: string): ValidationError | null {
    if (!name || name.trim().length === 0) {
      return {
        field: 'name',
        message: 'Название директории обязательно',
      };
    }

    if (name.trim().length < this.MIN_NAME_LENGTH) {
      return {
        field: 'name',
        message: `Название должно быть не менее ${this.MIN_NAME_LENGTH} символов`,
      };
    }

    if (name.length > this.MAX_NAME_LENGTH) {
      return {
        field: 'name',
        message: `Название не должно превышать ${this.MAX_NAME_LENGTH} символов`,
      };
    }

    return null;
  }

  static validateDirectory(data: {
    name?: string;
    type?: string;
    storageType?: string;
  }): ValidationError[] {
    const errors: ValidationError[] = [];

    if (data.name) {
      const nameError = this.validateName(data.name);
      if (nameError) errors.push(nameError);
    }

    if (!data.type || !['private', 'public'].includes(data.type)) {
      errors.push({
        field: 'type',
        message: 'Выберите тип директории',
      });
    }

    if (!data.storageType) {
      errors.push({
        field: 'storageType',
        message: 'Выберите тип хранилища',
      });
    }

    return errors;
  }
}
