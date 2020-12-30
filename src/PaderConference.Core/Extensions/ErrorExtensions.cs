﻿using System;
using System.Linq;
using FluentValidation.Results;
using PaderConference.Core.Dto;
using PaderConference.Core.Errors;

namespace PaderConference.Core.Extensions
{
    public static class ErrorExtensions
    {
        public static Error ToError(this ValidationResult validationResult)
        {
            if (validationResult.IsValid)
                throw new ArgumentException("The validation result must have failed.", nameof(validationResult));

            var error = validationResult.Errors.First();
            return new FieldValidationError(error.PropertyName, error.ErrorMessage);
        }
    }
}
