﻿using PaderConference.Core.Dto;
using PaderConference.Core.Errors;
using PaderConference.Core.Services.Permissions;

namespace PaderConference.Core.Services
{
    public class CommonError : ErrorsProvider<ServiceErrorCode>
    {
        public static Error PermissionDenied(PermissionDescriptor requiredPermission)
        {
            return NotFound(
                $"The permission to execute this action were denied. Required permission: {requiredPermission.Key}",
                ServiceErrorCode.PermissionDenied);
        }

        public static Error InternalServiceError(string message)
        {
            return InternalServerError(message, ServiceErrorCode.Conference_InternalServiceError);
        }

        public static Error ConcurrencyError => InternalServiceError("A concurrency error occurred.");
    }
}